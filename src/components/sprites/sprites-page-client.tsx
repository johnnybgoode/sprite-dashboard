// src/components/sprites/sprites-page-client.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { SpriteTable, SpriteRow } from "./sprite-table";
import { CreateSpriteDialog } from "./create-sprite-dialog";
import { getProvisioningMap } from "@/app/actions/provisioning";
import {
  getRCStatus,
  startRemoteControl,
  stopRemoteControl,
} from "@/app/actions/remote-control";
import { listSprites, stopSprite } from "@/app/actions/sprites";
import { toast } from "sonner";
import type { ProvisioningStatus } from "@/lib/github";

// Floor delay between RC poll cycles. Scheduled only AFTER a cycle settles so
// slow cycles can't stack (no fixed setInterval).
const POLL_DELAY_MS = 8000;
// How long an optimistic Start is protected from a non-exec status downgrade
// (a sprite mid warm→running). Only an exec-confirmed {active:false} clears it.
const GRACE_MS = 20000;
// Reduced grace for an unconfirmed Start (task add timed out server-side but
// likely registered) — lets a genuinely-failed task self-heal fast.
const SHORT_GRACE_MS = 5000;
// Max concurrent getRCStatus execs per cycle — caps exec saturation.
const RC_CONCURRENCY = 3;

export function SpritesPageClient({
  initialSprites,
}: {
  initialSprites: SpriteRow[];
}) {
  const [provisioningMap, setProvisioningMap] = useState<
    Record<string, ProvisioningStatus>
  >({});
  const [rcMap, setRcMap] = useState<Record<string, boolean>>({});
  const [graceUntil, setGraceUntil] = useState<Record<string, number>>({});
  const [sprites, setSprites] = useState(initialSprites);

  // Refs kept in sync via effects (NOT during render) so the self-scheduling
  // poll can read the latest values without re-subscribing.
  const provisioningRef = useRef(provisioningMap);
  useEffect(() => {
    provisioningRef.current = provisioningMap;
  }, [provisioningMap]);

  const graceRef = useRef(graceUntil);
  useEffect(() => {
    graceRef.current = graceUntil;
  }, [graceUntil]);

  const rcMapRef = useRef(rcMap);
  useEffect(() => {
    rcMapRef.current = rcMap;
  }, [rcMap]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function refreshProvisioning() {
      const map = await getProvisioningMap();
      if (!cancelled) {
        setProvisioningMap((prev) => ({ ...prev, ...map }));
      }
    }

    async function tick() {
      const current = await listSprites();
      if (cancelled) return;
      setSprites(current);

      // Refresh provisioning only while something is in-flight.
      const hasActiveProvisioning = Object.values(provisioningRef.current).some(
        (s) => s.phase === "pending" || s.phase === "running",
      );
      if (hasActiveProvisioning) refreshProvisioning();

      const running = current.filter((s) => s.status === "running");
      const nonRunning = current.filter((s) => s.status !== "running");

      // Snapshot grace deadlines for this cycle. Read from the ref (kept in
      // sync by an effect) to avoid a render-time ref write, and so the
      // merge logic below isn't dependent on stale closure state.
      const graceSnapshot = graceRef.current;
      const now = Date.now();

      // Skip-warm: non-running sprites are RC-inactive by definition. No exec.
      // During grace, preserve the prior (optimistic) value instead of
      // downgrading a warm sprite that's mid warm→running.
      const nonRunningUpdates: Record<string, boolean | undefined> = {};
      for (const s of nonRunning) {
        if ((graceSnapshot[s.name] ?? 0) > now) {
          nonRunningUpdates[s.name] = undefined; // keep prior
        } else {
          nonRunningUpdates[s.name] = false;
        }
      }

      // Seed-once: only running sprites with an UNKNOWN (undefined) RC value get
      // an exec. Known values (true/false) are kept as-is — no per-cycle exec.
      // A per-poll exec to confirm RC was proven untenable in this runtime
      // (exec floor ~6s, flaky), so we derive status without it once seeded.
      const rcSnapshot = rcMapRef.current;
      const seedTargets = running.filter(
        (s) => rcSnapshot[s.name] === undefined,
      );

      // Seed UNKNOWN running sprites via bounded exec, capped concurrency.
      type SeedResult = {
        name: string;
        outcome: "active" | "inactive" | "unknown";
      };
      const seedResults: SeedResult[] = [];
      let cursor = 0;
      async function worker() {
        while (cursor < seedTargets.length) {
          const s = seedTargets[cursor++];
          const settled = await Promise.allSettled([
            getRCStatus(s.name, "running"),
          ]);
          const r = settled[0];
          if (r.status === "fulfilled") {
            seedResults.push({
              name: s.name,
              outcome: r.value.active ? "active" : "inactive",
            });
          } else {
            // Timeout / rejection — leave UNKNOWN so it's retried next cycle.
            seedResults.push({ name: s.name, outcome: "unknown" });
          }
        }
      }
      await Promise.all(
        Array.from(
          { length: Math.min(RC_CONCURRENCY, seedTargets.length) },
          () => worker(),
        ),
      );
      if (cancelled) return;

      // nonRunningUpdates and seedResults are disjoint by construction (a sprite
      // is in exactly one of `running`/`nonRunning` per cycle), so the two loops
      // below never write the same name and ordering between them doesn't matter.
      setRcMap((prev) => {
        const next = { ...prev };
        for (const [name, val] of Object.entries(nonRunningUpdates)) {
          if (val === undefined) continue; // keep prior
          next[name] = val;
        }
        for (const { name, outcome } of seedResults) {
          // Only apply a seed if the value is STILL undefined — a concurrent
          // user action (handleStartRC/handleStopRC) may have set it since we
          // snapshotted; that wins, so we drop the stale seed.
          if (prev[name] !== undefined) continue;
          if (outcome === "active") {
            next[name] = true;
          } else if (outcome === "inactive") {
            next[name] = false;
          }
          // "unknown" (timeout) ⇒ leave absent so it's retried next cycle.
        }
        return next;
      });
    }

    async function run() {
      try {
        await tick();
      } catch {
        // Swallow — keep the loop alive; last-known state is preserved.
      } finally {
        if (!cancelled) {
          timer = setTimeout(run, POLL_DELAY_MS);
        }
      }
    }

    // Kick off immediately.
    refreshProvisioning();
    run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  function handleProvisioning(spriteName: string) {
    setProvisioningMap((prev) => ({
      ...prev,
      [spriteName]: { phase: "pending" },
    }));
  }

  async function handleStartRC(name: string) {
    const r = await startRemoteControl(name);
    if (r.ok) {
      setRcMap((m) => ({ ...m, [name]: true }));
      setGraceUntil((g) => ({
        ...g,
        [name]: Date.now() + (r.unconfirmed ? SHORT_GRACE_MS : GRACE_MS),
      }));
      toast.success(r.unconfirmed ? "Remote control starting" : "Remote control started", {
        description: r.unconfirmed
          ? `Started on ${name}; couldn't confirm keepalive yet — verifying.`
          : `Claude is running on ${name}. Open the Claude app to connect.`,
      });
    } else {
      toast.error("Failed to start remote control", { description: r.error });
    }
    return r;
  }

  async function handleStopRC(name: string) {
    const r = await stopRemoteControl(name);
    if (r.ok) {
      setRcMap((m) => ({ ...m, [name]: false }));
      setGraceUntil((g) => {
        const n = { ...g };
        delete n[name];
        return n;
      });
      toast.success(r.unconfirmed ? "Stopping remote control" : "Remote control stopped", {
        description: r.unconfirmed
          ? "Couldn't confirm deletion — will reconcile."
          : undefined,
      });
    } else {
      toast.error("Failed to stop remote control", { description: r.error });
    }
    return r;
  }

  async function handleStopSprite(name: string) {
    await stopSprite(name);
    // One-shot refresh so the row updates without waiting for the next poll.
    try {
      const updated = await listSprites();
      setSprites(updated);
    } catch {
      // Next poll will reconcile.
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-xl font-semibold">Sprites</h2>
        <CreateSpriteDialog onProvisioning={handleProvisioning} />
      </div>
      <SpriteTable
        sprites={sprites}
        provisioningMap={provisioningMap}
        rcMap={rcMap}
        onStartRC={handleStartRC}
        onStopRC={handleStopRC}
        onStopSprite={handleStopSprite}
      />
    </div>
  );
}
