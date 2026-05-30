import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSprite } from "@/lib/sprites";
import { SpriteStatusBadge } from "@/components/sprites/sprite-status-badge";
import { normalizeStatus } from "@/lib/sprite-status";
import { Badge } from "@/components/ui/badge";
import { SpriteDetailTabs } from "@/components/detail/sprite-detail-tabs";

export const dynamic = "force-dynamic";

export default async function SpriteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const sprite = await getSprite(name);

  return (
    <div>
      <div className="mb-4 md:mb-6 space-y-3 md:space-y-4">
        <Link
          href="/sprites"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sprites
        </Link>
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <h1 className="text-xl md:text-2xl font-bold font-mono break-all">{sprite.name}</h1>
          <SpriteStatusBadge status={normalizeStatus(sprite.status)} />
          {sprite.config && (
            <div className="flex flex-wrap gap-2">
              {sprite.config.cpus && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {sprite.config.cpus} CPU
                </Badge>
              )}
              {sprite.config.ramMB && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {sprite.config.ramMB} MB
                </Badge>
              )}
              {sprite.config.storageGB && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {sprite.config.storageGB} GB
                </Badge>
              )}
              {sprite.primaryRegion && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {sprite.primaryRegion}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
      <SpriteDetailTabs name={name} />
      <div className="mt-4 min-w-0 max-w-full">{children}</div>
    </div>
  );
}
