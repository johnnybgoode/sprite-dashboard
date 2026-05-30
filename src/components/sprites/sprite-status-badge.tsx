import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { color: string; pulse: boolean }> = {
  running: { color: "bg-terminal-green", pulse: true },
  starting: { color: "bg-terminal-yellow", pulse: true },
  stopping: { color: "bg-terminal-yellow", pulse: true },
  stopped: { color: "bg-muted-foreground", pulse: false },
  sleeping: { color: "bg-terminal-cyan", pulse: false },
  error: { color: "bg-terminal-red", pulse: false },
};

function configFor(status: string) {
  return statusConfig[status] ?? { color: "bg-muted-foreground", pulse: false };
}

export function SpriteStatusBadge({ status }: { status: string }) {
  const config = configFor(status);

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
  status: string;
  className?: string;
}) {
  const config = configFor(status);
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
