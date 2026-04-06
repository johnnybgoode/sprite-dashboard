import { getSprite } from "@/lib/sprites";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpgradeButton } from "@/components/upgrade/upgrade-button";

export const dynamic = "force-dynamic";

export default async function UpgradePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const sprite = await getSprite(name);
  const config = sprite.config;

  return (
    <div className="grid gap-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <UpgradeButton spriteName={name} />
    </div>
  );
}
