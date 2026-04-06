"use server";

import { requireAuth } from "@/lib/dev-auth";
import {
  createService as apiCreateService,
  startService as apiStartService,
  stopService as apiStopService,
  deleteService as apiDeleteService,
  signalService as apiSignalService,
} from "@/lib/sprites";
import { revalidatePath } from "next/cache";

export async function createService(spriteName: string, formData: FormData) {
  await requireAuth();

  const name = formData.get("name") as string;
  const cmd = formData.get("cmd") as string;
  const args = (formData.get("args") as string) || "";
  const port = formData.get("httpPort") as string;

  await apiCreateService(spriteName, name, {
    cmd,
    args: args ? args.split(" ") : undefined,
    httpPort: port ? parseInt(port) : undefined,
  });

  revalidatePath(`/sprites/${spriteName}/services`);
}

export async function startService(spriteName: string, serviceName: string) {
  await requireAuth();

  await apiStartService(spriteName, serviceName);
  revalidatePath(`/sprites/${spriteName}/services`);
}

export async function stopService(spriteName: string, serviceName: string) {
  await requireAuth();

  await apiStopService(spriteName, serviceName);
  revalidatePath(`/sprites/${spriteName}/services`);
}

export async function deleteService(spriteName: string, serviceName: string) {
  await requireAuth();

  await apiDeleteService(spriteName, serviceName);
  revalidatePath(`/sprites/${spriteName}/services`);
}

export async function signalService(
  spriteName: string,
  serviceName: string,
  signal: string
) {
  await requireAuth();

  await apiSignalService(spriteName, serviceName, signal);
  revalidatePath(`/sprites/${spriteName}/services`);
}
