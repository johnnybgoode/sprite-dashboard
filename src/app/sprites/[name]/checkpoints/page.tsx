import { getSprite } from "@/lib/sprites";
import { CheckpointTable } from "@/components/checkpoints/checkpoint-table";
import { CreateCheckpointDialog } from "@/components/checkpoints/create-checkpoint-dialog";

export const dynamic = "force-dynamic";

export default async function CheckpointsPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const sprite = await getSprite(name);
  const checkpoints = await sprite.listCheckpoints();

  const serialized = checkpoints.map((cp) => ({
    id: cp.id,
    createTime: cp.createTime.toISOString(),
    comment: cp.comment,
    history: cp.history,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Checkpoints</h2>
        <CreateCheckpointDialog spriteName={name} />
      </div>
      <CheckpointTable checkpoints={serialized} spriteName={name} />
    </div>
  );
}
