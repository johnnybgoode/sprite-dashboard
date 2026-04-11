// src/app/actions/provisioning.ts
"use server";

import { requireAuth } from "@/lib/dev-auth";
import {
  triggerProvisioningWorkflow,
  pollProvisioningRun,
  getRecentProvisioningRuns,
  ProvisioningStatus,
} from "@/lib/github";

export async function triggerProvisioning(
  spriteName: string,
  repoUrl: string
): Promise<{ dispatchedAt: string }> {
  await requireAuth();
  return triggerProvisioningWorkflow(spriteName, repoUrl);
}

export async function getProvisioningStatus(
  dispatchedAt: string
): Promise<ProvisioningStatus> {
  await requireAuth();
  return pollProvisioningRun(dispatchedAt);
}

export async function getProvisioningMap(): Promise<
  Record<string, ProvisioningStatus>
> {
  await requireAuth();
  return getRecentProvisioningRuns();
}
