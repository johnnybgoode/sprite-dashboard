import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SpriteStatus } from "@/components/sprites/sprite-status-badge";

type SpriteInfoProps = {
  name: string;
  id?: string;
  status: SpriteStatus;
  config?: {
    ramMB?: number;
    cpus?: number;
    region?: string;
    storageGB?: number;
  } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export function SpriteInfoCard({ name, id, status, config, createdAt, updatedAt }: SpriteInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sprite Info</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-mono">{name}</dd>

          {id && (
            <>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-mono text-xs">{id}</dd>
            </>
          )}

          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-mono">{status}</dd>

          {config?.cpus && (
            <>
              <dt className="text-muted-foreground">CPUs</dt>
              <dd className="font-mono">{config.cpus}</dd>
            </>
          )}

          {config?.ramMB && (
            <>
              <dt className="text-muted-foreground">RAM</dt>
              <dd className="font-mono">{config.ramMB} MB</dd>
            </>
          )}

          {config?.storageGB && (
            <>
              <dt className="text-muted-foreground">Storage</dt>
              <dd className="font-mono">{config.storageGB} GB</dd>
            </>
          )}

          {config?.region && (
            <>
              <dt className="text-muted-foreground">Region</dt>
              <dd className="font-mono">{config.region}</dd>
            </>
          )}

          {createdAt && (
            <>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-mono text-xs">{new Date(createdAt).toLocaleString()}</dd>
            </>
          )}

          {updatedAt && (
            <>
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="font-mono text-xs">{new Date(updatedAt).toLocaleString()}</dd>
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
