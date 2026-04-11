export const dynamic = "force-dynamic";

import { getClient } from "@/lib/sprites";
import { SpritesPageClient } from "@/components/sprites/sprites-page-client";

export default async function SpritesPage() {
  const client = getClient();
  const sprites = await client.listAllSprites();

  const initialSprites = sprites.map((s) => ({
    name: s.name,
    status: s.status ?? "unknown",
    config: s.config ?? null,
    createdAt: s.createdAt?.toISOString() ?? null,
    updatedAt: s.updatedAt?.toISOString() ?? null,
  }));

  return <SpritesPageClient initialSprites={initialSprites} />;
}
