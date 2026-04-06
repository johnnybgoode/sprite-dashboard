import { ExecBar } from "@/components/terminal/exec-bar";

export const dynamic = "force-dynamic";

export default async function TerminalPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;

  return (
    <div className="space-y-4">
      <ExecBar spriteName={name} />
    </div>
  );
}
