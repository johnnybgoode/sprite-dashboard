"use server";

import { requireAuth } from "@/lib/dev-auth";
import { execCommand } from "./terminal";

export async function startRemoteControl(
  spriteName: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();

  // Running exec will auto-wake the sprite if cold.
  // start-rc.sh launches claude in remote-control mode inside tmux.
  const result = await execCommand(
    spriteName,
    "bash ~/start-rc.sh > /tmp/rc.log 2>&1; cat /tmp/rc.log"
  );

  if (result.exitCode !== 0) {
    return { ok: false, error: result.stderr || "Failed to start remote control" };
  }

  return { ok: true };
}
