"use server";

import { auth } from "@/auth";
import { getSprite } from "@/lib/sprites";

export async function execCommand(spriteName: string, command: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const sprite = await getSprite(spriteName);
  const result = await sprite.exec(command);

  return {
    stdout:
      typeof result.stdout === "string"
        ? result.stdout
        : Buffer.from(result.stdout).toString("utf-8"),
    stderr:
      typeof result.stderr === "string"
        ? result.stderr
        : Buffer.from(result.stderr).toString("utf-8"),
    exitCode: result.exitCode,
  };
}
