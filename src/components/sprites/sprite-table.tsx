"use client";

import { useState } from "react";
import Link from "next/link";
import { SpriteStatusBadge, type SpriteStatus } from "./sprite-status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, Loader2, Play, Square } from "lucide-react";
import { ProvisioningBadge } from "./provisioning-badge";
import { SpriteCard } from "./sprite-card";
import type { ProvisioningStatus } from "@/lib/github";

export type SpriteRow = {
  name: string;
  status: SpriteStatus;
  config: { ramMB?: number; cpus?: number; region?: string; storageGB?: number } | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PendingKind = "stop" | "rc-start" | "rc-stop" | undefined;

export function SpriteTable({
  sprites,
  provisioningMap = {},
  rcMap = {},
  onStartRC,
  onStopRC,
  onStopSprite,
}: {
  sprites: SpriteRow[];
  provisioningMap?: Record<string, ProvisioningStatus>;
  rcMap?: Record<string, boolean>;
  onStartRC: (name: string) => Promise<{ ok: boolean; error?: string }>;
  onStopRC: (name: string) => Promise<{ ok: boolean; error?: string }>;
  onStopSprite: (name: string) => Promise<void>;
}) {
  const [pending, setPending] = useState<Record<string, PendingKind>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function run(
    name: string,
    kind: Exclude<PendingKind, undefined>,
    fn: () => Promise<unknown>,
  ) {
    setPending((p) => ({ ...p, [name]: kind }));
    try {
      await fn();
    } finally {
      setPending((p) => ({ ...p, [name]: undefined }));
    }
  }

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (sprites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <p className="font-mono text-muted-foreground">
          No sprites yet. Create one to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden flex flex-col gap-2">
        {sprites.map((sprite) => {
          const isRCActive = rcMap[sprite.name] ?? false;
          const p = pending[sprite.name];
          return (
            <SpriteCard
              key={sprite.name}
              sprite={sprite}
              isRCActive={isRCActive}
              provisioning={provisioningMap[sprite.name]}
              pending={p}
              expanded={expanded.has(sprite.name)}
              onToggle={() => toggle(sprite.name)}
              onStartRC={() => run(sprite.name, "rc-start", () => onStartRC(sprite.name))}
              onStopRC={() => run(sprite.name, "rc-stop", () => onStopRC(sprite.name))}
              onStopSprite={() => run(sprite.name, "stop", () => onStopSprite(sprite.name))}
            />
          );
        })}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Provisioning</TableHead>
              <TableHead>Config</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sprites.map((sprite) => {
              const isRCActive = rcMap[sprite.name] ?? false;
              const p = pending[sprite.name];

              return (
                <TableRow key={sprite.name}>
                  <TableCell className="font-mono">{sprite.name}</TableCell>
                  <TableCell>
                    <SpriteStatusBadge status={sprite.status} />
                  </TableCell>
                  <TableCell>
                    {provisioningMap[sprite.name] ? (
                      <ProvisioningBadge status={provisioningMap[sprite.name]} />
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {sprite.config
                      ? `${sprite.config.cpus ?? "?"}c / ${sprite.config.ramMB ?? "?"}MB / ${sprite.config.storageGB ?? "?"}GB`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {p === "rc-start" ? (
                        <Button variant="ghost" size="sm" disabled>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Starting
                        </Button>
                      ) : isRCActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => run(sprite.name, "rc-stop", () => onStopRC(sprite.name))}
                          disabled={p !== undefined}
                        >
                          <Square className="h-4 w-4" />
                          Stop RC
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => run(sprite.name, "rc-start", () => onStartRC(sprite.name))}
                          disabled={p !== undefined}
                        >
                          <Play className="h-4 w-4" />
                          RC
                        </Button>
                      )}
                      {sprite.status === "running" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => run(sprite.name, "stop", () => onStopSprite(sprite.name))}
                          disabled={p !== undefined}
                        >
                          <Square className="h-4 w-4" />
                          Stop
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/sprites/${sprite.name}`}>
                          Detail
                          <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
