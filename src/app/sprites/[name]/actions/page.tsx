import { getSprite } from "@/lib/sprites";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UpgradeButton } from "@/components/upgrade/upgrade-button";
import { DeleteSpriteButton } from "@/components/sprites/delete-sprite-button";

export const dynamic = "force-dynamic";

export default async function ActionsPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const sprite = await getSprite(name);
  const config = sprite.config;

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upgrade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {config?.cpus && (
              <Badge variant="secondary" className="font-mono">
                {config.cpus} CPUs
              </Badge>
            )}
            {config?.ramMB && (
              <Badge variant="secondary" className="font-mono">
                {config.ramMB} MB RAM
              </Badge>
            )}
            {config?.storageGB && (
              <Badge variant="secondary" className="font-mono">
                {config.storageGB} GB Storage
              </Badge>
            )}
            {config?.region && (
              <Badge variant="secondary" className="font-mono">
                {config.region}
              </Badge>
            )}
          </div>
          <UpgradeButton spriteName={name} />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <DeleteSpriteButton name={name} />
        </CardContent>
      </Card>
    </div>
  );
}
