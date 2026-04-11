// src/components/sprites/provisioning-badge.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import type { ProvisioningStatus } from "@/lib/github";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export function ProvisioningBadge({ status }: { status: ProvisioningStatus }) {
  if (status.phase === "pending" || status.phase === "running") {
    return (
      <Badge variant="outline" className="gap-1.5 font-mono text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        provisioning
      </Badge>
    );
  }

  if (status.phase === "success") {
    return (
      <Badge variant="outline" className="gap-1.5 font-mono text-xs">
        <CheckCircle2 className="h-3 w-3 text-green-500" />
        provisioned
      </Badge>
    );
  }

  // failure -- badge links to the GH Actions run
  return (
    <a href={status.runUrl} target="_blank" rel="noopener noreferrer">
      <Badge
        variant="outline"
        className="gap-1.5 font-mono text-xs hover:bg-accent cursor-pointer"
      >
        <XCircle className="h-3 w-3 text-red-500" />
        provision failed
      </Badge>
    </a>
  );
}
