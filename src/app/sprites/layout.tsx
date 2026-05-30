import { UserMenu } from "@/components/auth/user-menu";

export default function SpritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">
      <div className="flex items-center justify-between pb-4 md:pb-6">
        <div className="flex items-center gap-3">
          <pre className="text-xs leading-none font-mono select-none" aria-hidden="true">{`  __\n<(✦ )___\n (  ._>\n  \`--´`}</pre>
          <h1 className="text-xl md:text-2xl font-bold font-mono" aria-label="huskbit">hatch</h1>
        </div>
        <UserMenu />
      </div>
      {children}
    </div>
  );
}
