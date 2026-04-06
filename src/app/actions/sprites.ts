"use server";

import { auth } from "@/auth";
import { getClient, getSprite } from "@/lib/sprites";
import { revalidatePath } from "next/cache";

export async function listSprites() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const client = getClient();
  const sprites = await client.listAllSprites();
  return sprites.map((s) => ({
    name: s.name,
    status: s.status ?? "unknown",
    config: s.config ?? null,
    createdAt: s.createdAt?.toISOString() ?? null,
    updatedAt: s.updatedAt?.toISOString() ?? null,
  }));
}

export async function createSprite(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const ramMB = parseInt(formData.get("ramMB") as string) || 512;
  const cpus = parseInt(formData.get("cpus") as string) || 2;
  const storageGB = parseInt(formData.get("storageGB") as string) || 10;
  const region = (formData.get("region") as string) || undefined;

  const client = getClient();
  await client.createSprite(name, { ramMB, cpus, storageGB, region });
  revalidatePath("/sprites");
}

export async function deleteSprite(name: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const client = getClient();
  await client.deleteSprite(name);
  revalidatePath("/sprites");
}

export async function stopSprite(name: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const sprite = await getSprite(name);
  await sprite.exec("poweroff");
  revalidatePath("/sprites");
}

export async function upgradeSprite(name: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const client = getClient();
  await client.upgradeSprite(name);
  revalidatePath("/sprites");
}
