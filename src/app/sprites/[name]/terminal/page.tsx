import { TerminalPanel } from "@/components/terminal/terminal-panel";

export const dynamic = "force-dynamic";

export default async function TerminalPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;

  return (
    <div>
      <TerminalPanel spriteName={name} />
    </div>
  );
}
