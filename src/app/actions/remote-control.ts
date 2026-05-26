"use server";

import { requireAuth } from "@/lib/dev-auth";
import { getClient, getSprite } from "@/lib/sprites";
import { execWithTimeout, ExecTimeoutError } from "@/lib/sprite-exec";

const TASK_NAME = "remote-control";
const STATUS_TIMEOUT_MS = 25_000;
const MUTATION_TIMEOUT_MS = 25_000;

export async function startRemoteControl(
	spriteName: string,
): Promise<{ ok: boolean; error?: string; unconfirmed?: boolean }> {
	await requireAuth();

	// Use cheap handle — no control-plane GET needed for spawn/createSession.
	const sprite = getClient().sprite(spriteName);

	// Check if a session is already running. RC runs as a detached tmux session
	// named "claude" (created by start-rc), so check with `tmux has-session` —
	// listSessions() only sees sprite exec sessions, not tmux sessions. Without
	// this, a duplicate start would hit start-rc's `tmux new-session -s claude`
	// and fail on the name collision. exec only wakes a *cold* sprite (which has
	// no RC session anyway), so this check is safe.
	let sessionExists = false;
	try {
		await execWithTimeout(sprite, "tmux", ["has-session", "-t", "claude"], {
			timeoutMs: STATUS_TIMEOUT_MS,
		});
		sessionExists = true; // exit 0 ⇒ session already exists
	} catch (e) {
		if (e instanceof ExecTimeoutError) {
			// Timed out verifying state — do NOT proceed; a duplicate tmux new-session
			// would fail on the name collision if a session actually is running.
			return {
				ok: false,
				error: "Couldn't verify remote-control state, try again",
			};
		}
		// ExecError (non-zero exit) ⇒ no session.
	}

	// Create the session only if one isn't already running. We do NOT return
	// early when it exists: stop deletes the keepalive task but leaves the tmux
	// session, so a re-start must fall through and (re)register the task below —
	// otherwise RC would have no keepalive and the sprite would warm and drop it.
	if (!sessionExists) {
		try {
			// TODO If existing session: attach() - don't duplicate
			// Note ^ must attach tmux too.

			// Create a detachable session running Claude in remote-control mode.
			// Use bash -l for a login shell so ~/.bashrc and ~/.env are sourced.
			//
			// NOTE: createSession() auto-starts the command (via spawn → cmd.start()).
			// Calling cmd.start() again throws "Command already started", so we must not.

			const cmd = sprite.createSession("bash", ["-l", "-c", "start-rc"], {
				tty: true,
				detachable: true,
			});
			// Surface async start/connection errors instead of crashing on an unhandled
			// 'error' emit. Don't await cmd.wait() — let it run detached.
			cmd.on("error", (e) => console.error("RC session error:", e));
		} catch (err) {
			console.error("Failed to start remote control:", err);
			const message = err instanceof Error ? err.message : "Unknown error";
			return { ok: false, error: message };
		}
	}

	// Register/refresh the keepalive Task — runs on BOTH paths (new session and
	// pre-existing session), because `sprite-task add` is an idempotent upsert and
	// a lingering session may have no task. Separate try/catch so it's its own error.
	try {
		await execWithTimeout(sprite, "sprite-task", ["add", TASK_NAME, "1h"], {
			timeoutMs: MUTATION_TIMEOUT_MS,
		});
	} catch (err) {
		if (err instanceof ExecTimeoutError) {
			// The command runs server-side reliably; only the WS confirmation timed
			// out (observed: task registers despite a 15s timeout). Treat as optimistic
			// success — the caller uses a reduced grace so a genuinely-failed task
			// self-heals fast via the status downgrade. Consistent with createSession
			// (the actual RC launch) being fire-and-forget/unconfirmed.
			return { ok: true, unconfirmed: true };
		}
		console.error("Failed to register keepalive task:", err);
		const message = err instanceof Error ? err.message : "Unknown error";
		return {
			ok: false,
			error: `Session started but keepalive task failed: ${message}`,
		};
	}

	return { ok: true };
}

export async function stopRemoteControl(
	spriteName: string,
): Promise<{ ok: boolean; error?: string; unconfirmed?: boolean }> {
	await requireAuth();

	// Use cheap handle — no control-plane GET needed.
	const sprite = getClient().sprite(spriteName);

	try {
		await execWithTimeout(sprite, "sprite-task", ["delete", TASK_NAME], {
			timeoutMs: MUTATION_TIMEOUT_MS,
		});
		return { ok: true };
	} catch (e) {
		if (e instanceof ExecTimeoutError) {
			// delete runs server-side reliably; only confirmation timed out. Optimistic
			// success — the status downgrade reconciles if it somehow didn't delete.
			return { ok: true, unconfirmed: true };
		}
		// ExecError = task already absent ⇒ idempotent success.
		return { ok: true };
	}
}

export async function getRCStatus(
	spriteName: string,
	status?: string,
): Promise<{ active: boolean }> {
	await requireAuth();

	// Resolve effective status; back-compat for callers that don't pass status yet.
	let st = status;
	if (st === undefined) {
		try {
			st = (await getSprite(spriteName)).status;
		} catch {
			return { active: false };
		}
	}

	// A keepalive task holds the sprite "running". warm/cold ⇒ no active task ⇒
	// inactive. Skip the exec to avoid waking a cold sprite for a status check.
	if (st !== "running") return { active: false };

	// Sprite is running — confirm our specific task exists.
	const sprite = getClient().sprite(spriteName);
	try {
		const r = await execWithTimeout(sprite, "sprite-task", ["get", TASK_NAME], {
			timeoutMs: STATUS_TIMEOUT_MS,
		});
		return { active: !!r.stdout };
	} catch (e) {
		if (e instanceof ExecTimeoutError) {
			// Deliberately re-throw on timeout so the caller (Task C) can preserve
			// last-known state via allSettled rather than silently returning false.
			throw e;
		}
		// ExecError = task absent (sprite-task get exits non-zero when not found).
		return { active: false };
	}
}
