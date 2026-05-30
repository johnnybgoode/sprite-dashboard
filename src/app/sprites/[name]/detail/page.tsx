import { getSprite } from "@/lib/sprites";
import { SpriteInfoCard } from "@/components/detail/sprite-info-card";
import { SpriteMainActions } from "@/components/detail/sprite-main-actions";
import { ExecBar } from "@/components/terminal/exec-bar";

export const dynamic = "force-dynamic";

export default async function DetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const sprite = await getSprite(name);
  const status = sprite.status ?? "unknown";

  return (
    <div className="space-y-6">
      <SpriteMainActions name={name} status={status} />

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Quick Exec</h3>
        <ExecBar spriteName={name} />
      </div>

      <SpriteInfoCard
        name={sprite.name}
        id={sprite.id}
        status={status}
        config={sprite.config}
        createdAt={sprite.createdAt?.toISOString()}
        updatedAt={sprite.updatedAt?.toISOString()}
      />
    </div>
  );
}
