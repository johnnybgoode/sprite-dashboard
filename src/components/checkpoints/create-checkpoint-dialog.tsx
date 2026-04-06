"use client";

import { useActionState, useState } from "react";
import { createCheckpoint } from "@/app/actions/checkpoints";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateCheckpointDialog({
  spriteName,
}: {
  spriteName: string;
}) {
  const [open, setOpen] = useState(false);
  const [, formAction, isPending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      await createCheckpoint(spriteName, formData);
      setOpen(false);
      return null;
    },
    null
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Create Checkpoint</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Checkpoint</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="comment">Comment (optional)</Label>
              <Textarea
                id="comment"
                name="comment"
                placeholder="Describe this checkpoint..."
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
