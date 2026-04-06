export const dynamic = "force-dynamic";

import { getClient } from "@/lib/sprites";
import { SpriteTable } from "@/components/sprites/sprite-table";
import { CreateSpriteDialog } from "@/components/sprites/create-sprite-dialog";

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

  return (
    <div>
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-xl font-semibold">Sprites</h2>
        <CreateSpriteDialog />
      </div>
      <SpriteTable initialSprites={initialSprites} />
    </div>
  );
}
