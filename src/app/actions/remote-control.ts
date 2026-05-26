"use server";

import { requireAuth } from "@/lib/dev-auth";
import { getSprite } from "@/lib/sprites";

const TASK_NAME = "remote-control";

export async function startRemoteControl(
	spriteName: string,
): Promise<{ ok: boolean; error?: string }> {
	await requireAuth();

	try {
		const sprite = await getSprite(spriteName);

		// Check if a session is already running. RC runs as a detached tmux session
		// named "claude" (created by start-rc), so check with `tmux has-session` —
		// listSessions() only sees sprite exec sessions, not tmux sessions. Without
		// this, a duplicate start would hit start-rc's `tmux new-session -s claude`
		// and fail on the name collision. exec only wakes a *cold* sprite (which has
		// no RC session anyway), so this check is safe.
		const alreadyRunning = await sprite
			.exec("tmux has-session -t claude")
			.then(() => true)
			.catch(() => false);
		if (alreadyRunning) {
			return { ok: true }; // Already running, nothing to do
		}

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

	// Register the keepalive Task — separate try/catch so a task failure is its own error
	try {
		const sprite = await getSprite(spriteName);
		await sprite.exec(`sprite-task add ${TASK_NAME} 1h`);
	} catch (err) {
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
): Promise<{ ok: boolean; error?: string }> {
	await requireAuth();

	// Best-effort DELETE task — ignore failure (sprite may already be cold)
	try {
		const sprite = await getSprite(spriteName);
		await sprite.exec(`sprite-task delete ${TASK_NAME}`);
	} catch (e) {
		const message = e instanceof Error ? e.message : "Unknown error";
		return { ok: false, error: message };
	}

	return { ok: true };
}

export async function getRCStatus(
	spriteName: string,
): Promise<{ active: boolean }> {
	await requireAuth();

	try {
		const sprite = await getSprite(spriteName);
		if (sprite.status && !["running", "warm"].includes(sprite.status)) {
			return { active: false };
		}

		const result = await sprite.exec(`sprite-task get ${TASK_NAME}`);
		return { active: !!result.stdout };
	} catch {
		return { active: false };
	}
}
