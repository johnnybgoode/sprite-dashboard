"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Detail", href: "detail" },
  { label: "Terminal", href: "terminal" },
  { label: "Services", href: "services" },
  { label: "Checkpoints", href: "checkpoints" },
  { label: "Upgrade", href: "upgrade" },
];

export function SpriteDetailTabs({ name }: { name: string }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const href = `/sprites/${name}/${tab.href}`;
        const isActive = pathname === href;

        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
