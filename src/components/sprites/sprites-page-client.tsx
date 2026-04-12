// src/components/sprites/sprites-page-client.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { SpriteTable, SpriteRow } from "./sprite-table";
import { CreateSpriteDialog } from "./create-sprite-dialog";
import { getProvisioningMap } from "@/app/actions/provisioning";
import { getRCStatus } from "@/app/actions/remote-control";
import { listSprites } from "@/app/actions/sprites";
import type { ProvisioningStatus } from "@/lib/github";

export function SpritesPageClient({
  initialSprites,
}: {
  initialSprites: SpriteRow[];
}) {
  const [provisioningMap, setProvisioningMap] = useState<
    Record<string, ProvisioningStatus>
  >({});
  const [rcMap, setRcMap] = useState<Record<string, boolean>>({});
  const [sprites, setSprites] = useState(initialSprites);

  const mapRef = useRef(provisioningMap);
  mapRef.current = provisioningMap;

  useEffect(() => {
    let cancelled = false;

    async function refreshProvisioning() {
      const map = await getProvisioningMap();
      if (!cancelled) {
        setProvisioningMap((prev) => ({ ...prev, ...map }));
      }
    }

    async function refreshRC() {
      const currentSprites = await listSprites();
      if (cancelled) return;
      setSprites(currentSprites);

      const statuses: Record<string, boolean> = {};
      // Only check RC for warm/running sprites to avoid waking cold ones
      const activeSprites = currentSprites.filter(
        (s) => s.status === "running" || s.status === "warm"
      );
      await Promise.all(
        activeSprites.map(async (s) => {
          const { active } = await getRCStatus(s.name);
          statuses[s.name] = active;
        })
      );
      if (!cancelled) {
        setRcMap(statuses);
      }
    }

    refreshProvisioning();
    refreshRC();

    const interval = setInterval(() => {
      const hasActiveProvisioning = Object.values(mapRef.current).some(
        (s) => s.phase === "pending" || s.phase === "running"
      );
      if (hasActiveProvisioning) refreshProvisioning();
      refreshRC();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function handleProvisioning(spriteName: string, _dispatchedAt: string) {
    setProvisioningMap((prev) => ({ ...prev, [spriteName]: { phase: "pending" } }));
  }

  return (
    <div>
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-xl font-semibold">Sprites</h2>
        <CreateSpriteDialog onProvisioning={handleProvisioning} />
      </div>
      <SpriteTable
        initialSprites={sprites}
        provisioningMap={provisioningMap}
        rcMap={rcMap}
      />
    </div>
  );
}
