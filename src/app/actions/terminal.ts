"use server";

import { ExecError } from "@fly/sprites";
import { requireAuth } from "@/lib/dev-auth";
import { getSprite } from "@/lib/sprites";

function toString(v: string | Buffer | Uint8Array): string {
  return typeof v === "string" ? v : Buffer.from(v).toString("utf-8");
}

export async function execCommand(spriteName: string, command: string) {
  await requireAuth();

  const sprite = await getSprite(spriteName);
  try {
    const result = await sprite.execFile("bash", ["-c", command]);
    return {
      stdout: toString(result.stdout),
      stderr: toString(result.stderr),
      exitCode: result.exitCode,
    };
  } catch (e) {
    if (e instanceof ExecError) {
      return {
        stdout: toString(e.stdout ?? ""),
        stderr: toString(e.stderr ?? ""),
        exitCode: e.exitCode ?? 1,
      };
    }
    throw e;
  }
}
