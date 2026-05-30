"use client";

import Link from "next/link";
import { SpriteStatusBadge, SpriteStatusDot } from "./sprite-status-badge";
import { ProvisioningBadge } from "./provisioning-badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  Square,
} from "lucide-react";
import type { ProvisioningStatus } from "@/lib/github";
import type { PendingKind, SpriteRow } from "./sprite-table";

export function SpriteCard({
  sprite,
  isRCActive,
  provisioning,
  pending,
  expanded,
  onToggle,
  onStartRC,
  onStopRC,
  onStopSprite,
}: {
  sprite: SpriteRow;
  isRCActive: boolean;
  provisioning?: ProvisioningStatus;
  pending: PendingKind;
  expanded: boolean;
  onToggle: () => void;
  onStartRC: () => void;
  onStopRC: () => void;
  onStopSprite: () => void;
}) {
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-3 py-3 text-left min-h-[44px] cursor-pointer touch-manipulation active:bg-accent/50"
      >
        <ChevronIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SpriteStatusDot status={sprite.status} />
        <span className="font-mono text-sm truncate flex-1">{sprite.name}</span>
      </button>

      {expanded && (
        <div className="border-t px-3 py-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <SpriteStatusBadge status={sprite.status} />
            {provisioning ? <ProvisioningBadge status={provisioning} /> : null}
          </div>

          {sprite.config && (
            <div className="font-mono text-xs text-muted-foreground">
              {`${sprite.config.cpus ?? "?"}c / ${sprite.config.ramMB ?? "?"}MB / ${sprite.config.storageGB ?? "?"}GB`}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {pending === "rc-start" ? (
              <Button variant="outline" size="sm" disabled className="min-h-[40px] min-w-[88px]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting
              </Button>
            ) : isRCActive ? (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive min-h-[40px] min-w-[88px]"
                onClick={onStopRC}
                disabled={pending !== undefined}
              >
                <Square className="h-4 w-4" />
                Stop RC
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="min-h-[40px] min-w-[88px]"
                onClick={onStartRC}
                disabled={pending !== undefined}
              >
                <Play className="h-4 w-4" />
                RC
              </Button>
            )}
            {sprite.status === "running" && (
              <Button
                variant="outline"
                size="sm"
                className="min-h-[40px] min-w-[88px]"
                onClick={onStopSprite}
                disabled={pending !== undefined}
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}
            <Button variant="outline" size="sm" asChild className="min-h-[40px] min-w-[88px]">
              <Link href={`/sprites/${sprite.name}`}>
                Detail
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
