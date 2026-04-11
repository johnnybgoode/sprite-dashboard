// src/components/sprites/sprites-page-client.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { SpriteTable, SpriteRow } from "./sprite-table";
import { CreateSpriteDialog } from "./create-sprite-dialog";
import { getProvisioningMap } from "@/app/actions/provisioning";
import type { ProvisioningStatus } from "@/lib/github";

export function SpritesPageClient({
  initialSprites,
}: {
  initialSprites: SpriteRow[];
}) {
  // Maps sprite name -> provisioning status, rehydrated from GH on mount
  const [provisioningMap, setProvisioningMap] = useState<
    Record<string, ProvisioningStatus>
  >({});

  const mapRef = useRef(provisioningMap);
  mapRef.current = provisioningMap;

  // Rehydrate provisioning state from GH Actions runs on mount,
  // then poll every 5s while any entries are still pending/running.
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const map = await getProvisioningMap();
      if (!cancelled) {
        setProvisioningMap((prev) => ({ ...prev, ...map }));
      }
    }

    refresh();

    const interval = setInterval(() => {
      const hasActive = Object.values(mapRef.current).some(
        (s) => s.phase === "pending" || s.phase === "running"
      );
      if (hasActive) refresh();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function handleProvisioning(spriteName: string, _dispatchedAt: string) {
    // Immediately show "pending" for the new sprite; polling will pick up the real status
    setProvisioningMap((prev) => ({ ...prev, [spriteName]: { phase: "pending" } }));
  }

  return (
    <div>
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-xl font-semibold">Sprites</h2>
        <CreateSpriteDialog onProvisioning={handleProvisioning} />
      </div>
      <SpriteTable
        initialSprites={initialSprites}
        provisioningMap={provisioningMap}
      />
    </div>
  );
}
