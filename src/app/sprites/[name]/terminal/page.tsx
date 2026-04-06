import { ExecBar } from "@/components/terminal/exec-bar";
import { TerminalPanel } from "@/components/terminal/terminal-panel";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function TerminalPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Quick Exec</h3>
        <ExecBar spriteName={name} />
      </div>
      <Separator />
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Interactive Terminal</h3>
        <TerminalPanel spriteName={name} />
      </div>
    </div>
  );
}
