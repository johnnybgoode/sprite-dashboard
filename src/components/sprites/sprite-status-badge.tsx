import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SpriteStatus = "cold" | "warm" | "running";

const statusConfig: Record<SpriteStatus, { color: string; pulse: boolean }> = {
  running: { color: "bg-terminal-green", pulse: true },
  warm: { color: "bg-terminal-yellow", pulse: false },
  cold: { color: "bg-muted-foreground", pulse: false },
};

export function SpriteStatusBadge({ status }: { status: SpriteStatus }) {
  const config = statusConfig[status];

  return (
    <Badge variant="outline" className="gap-1.5 font-mono text-xs">
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          config.color,
          config.pulse && "animate-pulse"
        )}
      />
      {status}
    </Badge>
  );
}

export function SpriteStatusDot({
  status,
  className,
}: {
  status: SpriteStatus;
  className?: string;
}) {
  const config = statusConfig[status];
  return (
    <span
      aria-label={`status: ${status}`}
      title={status}
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full shrink-0",
        config.color,
        config.pulse && "animate-pulse",
        className
      )}
    />
  );
}
