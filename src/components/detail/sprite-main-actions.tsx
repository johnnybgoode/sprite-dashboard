"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Square } from "lucide-react";
import { toast } from "sonner";
import {
  getRCStatus,
  startRemoteControl,
  stopRemoteControl,
} from "@/app/actions/remote-control";
import { startSprite, stopSprite } from "@/app/actions/sprites";
import { useEffect } from "react";
import type { SpriteStatus } from "@/components/sprites/sprite-status-badge";

type Pending = "rc-start" | "rc-stop" | "start" | "stop" | undefined;

export function SpriteMainActions({
  name,
  status,
}: {
  name: string;
  status: SpriteStatus;
}) {
  const [pending, setPending] = useState<Pending>(undefined);
  const [rcActive, setRcActive] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (status !== "running") {
      setRcActive(false);
      return;
    }
    getRCStatus(name, status)
      .then((r) => {
        if (!cancelled) setRcActive(r.active);
      })
      .catch(() => {
        if (!cancelled) setRcActive(false);
      });
    return () => {
      cancelled = true;
    };
  }, [name, status]);

  async function handleStartRC() {
    setPending("rc-start");
    try {
      const r = await startRemoteControl(name);
      if (r.ok) {
        setRcActive(true);
        toast.success(
          r.unconfirmed ? "Remote control starting" : "Remote control started",
        );
      } else {
        toast.error("Failed to start remote control", { description: r.error });
      }
    } finally {
      setPending(undefined);
    }
  }

  async function handleStopRC() {
    setPending("rc-stop");
    try {
      const r = await stopRemoteControl(name);
      if (r.ok) {
        setRcActive(false);
        toast.success(
          r.unconfirmed ? "Stopping remote control" : "Remote control stopped",
        );
      } else {
        toast.error("Failed to stop remote control", { description: r.error });
      }
    } finally {
      setPending(undefined);
    }
  }

  async function handleStop() {
    setPending("stop");
    try {
      await stopSprite(name);
      toast.success("Stop requested");
    } finally {
      setPending(undefined);
    }
  }

  async function handleStart() {
    setPending("start");
    try {
      await startSprite(name);
      toast.success("Start requested");
    } catch (e) {
      toast.error("Failed to start sprite", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setPending(undefined);
    }
  }

  const btn = "min-h-[40px] min-w-[110px]";

  return (
    <div className="flex flex-wrap gap-2">
      {pending === "rc-start" ? (
        <Button variant="outline" disabled className={btn}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Starting RC
        </Button>
      ) : rcActive ? (
        <Button
          variant="outline"
          onClick={handleStopRC}
          disabled={pending !== undefined}
          className={`text-destructive ${btn}`}
        >
          <Square className="h-4 w-4" />
          Stop RC
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={handleStartRC}
          disabled={pending !== undefined}
          className={btn}
        >
          <Play className="h-4 w-4" />
          RC
        </Button>
      )}

      {status === "running" ? (
        <Button
          variant="outline"
          onClick={handleStop}
          disabled={pending !== undefined}
          className={btn}
        >
          {pending === "stop" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          Stop
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={handleStart}
          disabled={pending !== undefined}
          className={btn}
        >
          {pending === "start" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Start
        </Button>
      )}
    </div>
  );
}
