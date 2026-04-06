import { SpritesClient } from "@fly/sprites";

export function getClient() {
  return new SpritesClient(process.env.SPRITES_API_TOKEN!);
}

export function getSprite(name: string) {
  return getClient().getSprite(name);
}

// --- Service types and helpers (not yet in the SDK) ---

export interface ServiceConfig {
  cmd: string;
  args?: string[];
  httpPort?: number;
}

export interface ServiceState {
  status: string;
  pid?: number;
}

export interface ServiceInfo {
  name: string;
  cmd: string;
  args?: string[];
  httpPort?: number;
  needs?: string[];
  state?: ServiceState;
}

function spriteApiHeaders() {
  return {
    Authorization: `Bearer ${process.env.SPRITES_API_TOKEN!}`,
    "Content-Type": "application/json",
  };
}

function spriteBaseURL() {
  return getClient().baseURL;
}

export async function listServices(spriteName: string): Promise<ServiceInfo[]> {
  const response = await fetch(
    `${spriteBaseURL()}/v1/sprites/${spriteName}/services`,
    {
      method: "GET",
      headers: spriteApiHeaders(),
      signal: AbortSignal.timeout(30000),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to list services (status ${response.status}): ${text}`);
  }
  return response.json();
}

export async function createService(
  spriteName: string,
  name: string,
  config: ServiceConfig
): Promise<void> {
  const response = await fetch(
    `${spriteBaseURL()}/v1/sprites/${spriteName}/services/${name}`,
    {
      method: "PUT",
      headers: spriteApiHeaders(),
      body: JSON.stringify(config),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create service (status ${response.status}): ${text}`);
  }
  await response.text();
}

export async function startService(
  spriteName: string,
  serviceName: string
): Promise<void> {
  const response = await fetch(
    `${spriteBaseURL()}/v1/sprites/${spriteName}/services/${serviceName}/start`,
    {
      method: "POST",
      headers: spriteApiHeaders(),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to start service (status ${response.status}): ${text}`);
  }
  await response.text();
}

export async function stopService(
  spriteName: string,
  serviceName: string
): Promise<void> {
  const response = await fetch(
    `${spriteBaseURL()}/v1/sprites/${spriteName}/services/${serviceName}/stop`,
    {
      method: "POST",
      headers: spriteApiHeaders(),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to stop service (status ${response.status}): ${text}`);
  }
  await response.text();
}

export async function deleteService(
  spriteName: string,
  serviceName: string
): Promise<void> {
  const response = await fetch(
    `${spriteBaseURL()}/v1/sprites/${spriteName}/services/${serviceName}`,
    {
      method: "DELETE",
      headers: spriteApiHeaders(),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to delete service (status ${response.status}): ${text}`);
  }
}

export async function signalService(
  spriteName: string,
  serviceName: string,
  signal: string
): Promise<void> {
  const response = await fetch(
    `${spriteBaseURL()}/v1/sprites/${spriteName}/services/signal`,
    {
      method: "POST",
      headers: spriteApiHeaders(),
      body: JSON.stringify({ name: serviceName, signal }),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to signal service (status ${response.status}): ${text}`);
  }
}
