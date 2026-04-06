"use server";

import { auth } from "@/auth";
import { getSprite } from "@/lib/sprites";
import { revalidatePath } from "next/cache";

export async function createCheckpoint(spriteName: string, formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const comment = (formData.get("comment") as string) || undefined;
  const sprite = await getSprite(spriteName);
  const resp = await sprite.createCheckpoint(comment);
  await resp.text();

  revalidatePath(`/sprites/${spriteName}/checkpoints`);
}

export async function restoreCheckpoint(
  spriteName: string,
  checkpointId: string
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const sprite = await getSprite(spriteName);
  const resp = await sprite.restoreCheckpoint(checkpointId);
  await resp.text();

  revalidatePath(`/sprites/${spriteName}/checkpoints`);
}
