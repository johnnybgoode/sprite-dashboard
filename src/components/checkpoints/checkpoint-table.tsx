"use client";

import { useTransition } from "react";
import { restoreCheckpoint } from "@/app/actions/checkpoints";
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
import { Button } from "@/components/ui/button";

interface SerializedCheckpoint {
  id: string;
  createTime: string;
  comment?: string;
  history?: string[];
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function RestoreButton({
  spriteName,
  checkpointId,
}: {
  spriteName: string;
  checkpointId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          {isPending ? "Restoring..." : "Restore"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore checkpoint?</AlertDialogTitle>
          <AlertDialogDescription>
            This will restore the sprite to checkpoint{" "}
            <span className="font-mono">{checkpointId}</span>. Any changes made
            after this checkpoint will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              startTransition(() => {
                restoreCheckpoint(spriteName, checkpointId);
              });
            }}
          >
            Restore
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CheckpointTable({
  checkpoints,
  spriteName,
}: {
  checkpoints: SerializedCheckpoint[];
  spriteName: string;
}) {
  if (checkpoints.length === 0) {
    return (
      <div className="text-muted-foreground font-mono text-sm py-8 text-center">
        No checkpoints yet
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Comment</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {checkpoints.map((cp) => (
          <TableRow key={cp.id}>
            <TableCell className="font-mono text-xs">
              {cp.id.slice(0, 8)}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {timeAgo(cp.createTime)}
            </TableCell>
            <TableCell className="text-sm">
              {cp.comment || <span className="text-muted-foreground">&mdash;</span>}
            </TableCell>
            <TableCell className="text-right">
              <RestoreButton spriteName={spriteName} checkpointId={cp.id} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
