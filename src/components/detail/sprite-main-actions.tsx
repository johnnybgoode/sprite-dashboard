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
import { stopSprite } from "@/app/actions/sprites";
import { useEffect } from "react";

type Pending = "rc-start" | "rc-stop" | "stop" | undefined;

export function SpriteMainActions({
  name,
  status,
}: {
  name: string;
  status: string;
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

  return (
    <div className="flex flex-wrap gap-2">
      {pending === "rc-start" ? (
        <Button variant="outline" disabled className="min-h-[40px]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Starting RC
        </Button>
      ) : rcActive ? (
        <Button
          variant="outline"
          onClick={handleStopRC}
          disabled={pending !== undefined}
          className="text-destructive min-h-[40px]"
        >
          <Square className="h-4 w-4" />
          Stop RC
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={handleStartRC}
          disabled={pending !== undefined}
          className="min-h-[40px]"
        >
          <Play className="h-4 w-4" />
          RC
        </Button>
      )}

      {status === "running" && (
        <Button
          variant="outline"
          onClick={handleStop}
          disabled={pending !== undefined}
          className="min-h-[40px]"
        >
          {pending === "stop" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          Stop
        </Button>
      )}
    </div>
  );
}
