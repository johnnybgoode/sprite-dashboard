import { UserMenu } from "@/components/auth/user-menu";

export default function SpritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <div className="flex items-center justify-between pb-6">
        <h1 className="text-2xl font-bold font-mono">sprites.dev</h1>
        <UserMenu />
      </div>
      {children}
    </div>
  );
}
