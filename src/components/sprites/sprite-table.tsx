"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { listSprites, stopSprite } from "@/app/actions/sprites";
import {
  startRemoteControl,
  stopRemoteControl,
} from "@/app/actions/remote-control";
import { SpriteStatusBadge } from "./sprite-status-badge";
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
import { toast } from "sonner";
import { ProvisioningBadge } from "./provisioning-badge";
import type { ProvisioningStatus } from "@/lib/github";

export type SpriteRow = {
  name: string;
  status: string;
  config: { ramMB?: number; cpus?: number; region?: string; storageGB?: number } | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export function SpriteTable({
  initialSprites,
  provisioningMap = {},
  rcMap = {},
}: {
  initialSprites: SpriteRow[];
  provisioningMap?: Record<string, ProvisioningStatus>;
  rcMap?: Record<string, boolean>;
}) {
  const [sprites, setSprites] = useState(initialSprites);
  const [isPending, startTransition] = useTransition();
  const [rcStarting, setRcStarting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      listSprites().then(setSprites).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  function handleStop(name: string) {
    startTransition(async () => {
      await stopSprite(name);
      const updated = await listSprites();
      setSprites(updated);
    });
  }

  function handleStartRC(name: string) {
    setRcStarting((prev) => ({ ...prev, [name]: true }));
    startTransition(async () => {
      const result = await startRemoteControl(name);
      setRcStarting((prev) => ({ ...prev, [name]: false }));
      if (result.ok) {
        toast.success("Remote control started", {
          description: `Claude is running on ${name}. Open the Claude app to connect.`,
        });
      } else {
        toast.error("Failed to start remote control", {
          description: result.error,
        });
      }
      const updated = await listSprites();
      setSprites(updated);
    });
  }

  function handleStopRC(name: string) {
    startTransition(async () => {
      const result = await stopRemoteControl(name);
      if (result.ok) {
        toast.success("Remote control stopped");
      } else {
        toast.error("Failed to stop remote control", {
          description: result.error,
        });
      }
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
          const isRCStarting = rcStarting[sprite.name] ?? false;

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
                  {isRCStarting ? (
                    <Button variant="ghost" size="sm" disabled>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting
                    </Button>
                  ) : isRCActive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleStopRC(sprite.name)}
                      disabled={isPending}
                    >
                      <Square className="h-4 w-4" />
                      Stop RC
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartRC(sprite.name)}
                      disabled={isPending}
                    >
                      <Play className="h-4 w-4" />
                      RC
                    </Button>
                  )}
                  {sprite.status === "running" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStop(sprite.name)}
                      disabled={isPending}
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
  );
}
