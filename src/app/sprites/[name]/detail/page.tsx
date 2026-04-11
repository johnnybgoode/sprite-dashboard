import { getSprite } from "@/lib/sprites";
import { SpriteInfoCard } from "@/components/detail/sprite-info-card";
import { DeleteSpriteButton } from "@/components/sprites/delete-sprite-button";

export const dynamic = "force-dynamic";

export default async function DetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const sprite = await getSprite(name);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        <SpriteInfoCard
          name={sprite.name}
          id={sprite.id}
          status={sprite.status ?? "unknown"}
          config={sprite.config}
          createdAt={sprite.createdAt?.toISOString()}
          updatedAt={sprite.updatedAt?.toISOString()}
        />
      </div>
      <div>
        <DeleteSpriteButton name={name} />
      </div>
    </div>
  );
}
