"use client";

import { useActionState, useState } from "react";
import { createSprite } from "@/app/actions/sprites";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface CreateSpriteDialogProps {
  onProvisioning: (spriteName: string, dispatchedAt: string) => void;
}

export function CreateSpriteDialog({ onProvisioning }: CreateSpriteDialogProps) {
  const [open, setOpen] = useState(false);
  const [, action, isPending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const result = await createSprite(formData);
      if (result.dispatchedAt) {
        onProvisioning(result.name, result.dispatchedAt);
        setOpen(false);
      } else {
        toast.error("Provisioning failed to start", {
          description: result.error ?? "Could not trigger the provisioning workflow.",
        });
        // Dialog stays open so the user can retry
      }
    },
    null
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Sprite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={action}>
          <DialogHeader>
            <DialogTitle>Create Sprite</DialogTitle>
            <DialogDescription>
              Launch a new cloud VM with the specified configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="my-sprite"
                required
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cpus">CPUs</Label>
                <Input
                  id="cpus"
                  name="cpus"
                  type="number"
                  defaultValue={2}
                  min={1}
                  max={8}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ramMB">RAM (MB)</Label>
                <Input
                  id="ramMB"
                  name="ramMB"
                  type="number"
                  defaultValue={512}
                  min={256}
                  max={16384}
                  step={256}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="storageGB">Storage (GB)</Label>
                <Input
                  id="storageGB"
                  name="storageGB"
                  type="number"
                  defaultValue={10}
                  min={1}
                  max={100}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="region">Region (optional)</Label>
              <Input
                id="region"
                name="region"
                placeholder="e.g. us-east-1"
                className="font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="repoUrl">GitHub repo URL (optional)</Label>
              <Input
                id="repoUrl"
                name="repoUrl"
                placeholder="https://github.com/you/your-repo"
                className="font-mono"
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
