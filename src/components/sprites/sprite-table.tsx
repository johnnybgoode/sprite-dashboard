"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { listSprites, deleteSprite, stopSprite } from "@/app/actions/sprites";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowRight, Square, Trash2 } from "lucide-react";

export type SpriteRow = {
  name: string;
  status: string;
  config: { ramMB?: number; cpus?: number; region?: string; storageGB?: number } | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export function SpriteTable({ initialSprites }: { initialSprites: SpriteRow[] }) {
  const [sprites, setSprites] = useState(initialSprites);
  const [isPending, startTransition] = useTransition();

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

  function handleDelete(name: string) {
    startTransition(async () => {
      await deleteSprite(name);
      const updated = await listSprites();
      setSprites(updated);
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
          <TableHead>Config</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sprites.map((sprite) => (
          <TableRow key={sprite.name}>
            <TableCell className="font-mono">{sprite.name}</TableCell>
            <TableCell>
              <SpriteStatusBadge status={sprite.status} />
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {sprite.config
                ? `${sprite.config.cpus ?? "?"}c / ${sprite.config.ramMB ?? "?"}MB / ${sprite.config.storageGB ?? "?"}GB`
                : "—"}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
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
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {sprite.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the sprite and all its data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(sprite.name)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/sprites/${sprite.name}`}>
                    Detail
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
