export const dynamic = "force-dynamic";

import { getClient } from "@/lib/sprites";
import { SpritesPageClient } from "@/components/sprites/sprites-page-client";
import { normalizeStatus } from "@/lib/sprite-status";

export default async function SpritesPage() {
  const client = getClient();
  const sprites = await client.listAllSprites();

  const initialSprites = sprites.map((s) => ({
    name: s.name,
    status: normalizeStatus(s.status),
    config: s.config ?? null,
    createdAt: s.createdAt?.toISOString() ?? null,
    updatedAt: s.updatedAt?.toISOString() ?? null,
  }));

  return <SpritesPageClient initialSprites={initialSprites} />;
}
