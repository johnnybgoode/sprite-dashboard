"use server";

import { requireAuth } from "@/lib/dev-auth";
import { getSprite } from "@/lib/sprites";
import type { Sprite } from "@fly/sprites";

const PUT_TASK_CMD =
  "curl -fsS --unix-socket /.sprite/api.sock -X PUT -H 'Content-Type: application/json' -d '{\"expire\":\"1h\"}' http://sprite/v1/tasks/remote-control";

const DELETE_TASK_CMD =
  "curl -fsS --unix-socket /.sprite/api.sock -X DELETE http://sprite/v1/tasks/remote-control";

async function taskCall(sprite: Sprite, method: "PUT" | "DELETE"): Promise<void> {
  const cmd = method === "PUT" ? PUT_TASK_CMD : DELETE_TASK_CMD;
  await sprite.execFile("bash", ["-c", cmd]);
}

export async function startRemoteControl(
  spriteName: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();

  try {
    const sprite = await getSprite(spriteName);

    // Check if a session is already running
    const sessions = await sprite.listSessions();
    if (sessions.some((s) => s.isActive)) {
      return { ok: true }; // Already running, nothing to do
    }

    // Create a detachable tmux session running Claude in remote-control mode.
    // Use bash -l to get a login shell so ~/.bashrc and ~/.env are sourced.
    const cmd = sprite.createSession(
      "bash",
      ["-l", "-c", "claude --dangerously-skip-permissions --remote-control"],
      { tty: true },
    );
    await cmd.start();

    // Don't await cmd.wait() — let it run detached
  } catch (err) {
    console.error("Failed to start remote control:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }

  // Register the keepalive Task — separate try/catch so a task failure is its own error
  try {
    const sprite = await getSprite(spriteName);
    await taskCall(sprite, "PUT");
  } catch (err) {
    console.error("Failed to register keepalive task:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `Session started but keepalive task failed: ${message}` };
  }

  return { ok: true };
}

export async function stopRemoteControl(
  spriteName: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();

  let killOk = true;
  let killError: string | undefined;

  try {
    const sprite = await getSprite(spriteName);
    // Route through bash so 2>/dev/null and || true are parsed by a real shell
    await sprite.execFile("bash", ["-c", "tmux kill-session -t claude 2>/dev/null || true"]);
  } catch (err) {
    console.error("Failed to kill RC session:", err);
    killOk = false;
    killError = err instanceof Error ? err.message : "Unknown error";
  }

  // Best-effort DELETE task — ignore failure (sprite may already be cold)
  try {
    const sprite = await getSprite(spriteName);
    await taskCall(sprite, "DELETE");
  } catch {
    // Intentionally ignored
  }

  return killOk ? { ok: true } : { ok: false, error: killError };
}

export async function getRCStatus(
  spriteName: string
): Promise<{ active: boolean }> {
  await requireAuth();

  try {
    const sprite = await getSprite(spriteName);
    const sessions = await sprite.listSessions();
    const active = sessions.some((s) => s.isActive);
    return { active };
  } catch {
    return { active: false };
  }
}
