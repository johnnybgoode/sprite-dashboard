"use server";

import { requireAuth } from "@/lib/dev-auth";
import { getSprite } from "@/lib/sprites";

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
    return { ok: true };
  } catch (err) {
    console.error("Failed to start remote control:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}

export async function stopRemoteControl(
  spriteName: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();

  try {
    const sprite = await getSprite(spriteName);

    // Kill the tmux session by executing tmux kill-session
    await sprite.exec("tmux kill-session -t claude 2>/dev/null || true");

    return { ok: true };
  } catch (err) {
    console.error("Failed to stop remote control:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}

export async function pingSprite(
  spriteName: string
): Promise<{ ok: boolean }> {
  await requireAuth();

  try {
    const sprite = await getSprite(spriteName);
    await sprite.exec("true");
    return { ok: true };
  } catch {
    return { ok: false };
  }
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
