import type { SpriteCommand } from "@fly/sprites";

const sessions = new Map<string, SpriteCommand>();

export function getSession(key: string): SpriteCommand | undefined {
  return sessions.get(key);
}

export function setSession(key: string, cmd: SpriteCommand): void {
  sessions.set(key, cmd);
}

export function deleteSession(key: string): void {
  sessions.delete(key);
}
