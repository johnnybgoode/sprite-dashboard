"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SessionInfo = {
  id: string;
  command: string;
  isActive: boolean;
};

export function SessionPicker({
  spriteName,
  onSelect,
}: {
  spriteName: string;
  onSelect: (sessionId: string) => void;
}) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch(`/api/sprites/${spriteName}/sessions`);
        if (res.ok) {
          const data = await res.json();
          setSessions(data);
        }
      } catch {
        // ignore
      }
    }
    fetchSessions();
  }, [spriteName]);

  if (sessions.length === 0) return null;

  return (
    <Select onValueChange={onSelect}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Attach to session..." />
      </SelectTrigger>
      <SelectContent>
        {sessions.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <span className="font-mono text-xs">
              {s.id.slice(0, 8)} — {s.command}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
