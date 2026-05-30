import type { SpriteStatus } from "@/components/sprites/sprite-status-badge";

const KNOWN: ReadonlySet<SpriteStatus> = new Set(["cold", "warm", "running"]);

export function normalizeStatus(raw: string | undefined | null): SpriteStatus {
  return raw && KNOWN.has(raw as SpriteStatus) ? (raw as SpriteStatus) : "cold";
}
