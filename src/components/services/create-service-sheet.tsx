"use client";

import { useActionState, useState } from "react";
import { createService } from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Plus } from "lucide-react";

export function CreateServiceSheet({ spriteName }: { spriteName: string }) {
  const [open, setOpen] = useState(false);

  const [error, formAction, isPending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      try {
        await createService(spriteName, formData);
        setOpen(false);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : "Failed to create service";
      }
    },
    null
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Service
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Create Service</SheetTitle>
          <SheetDescription>
            Add a new service to{" "}
            <span className="font-mono">{spriteName}</span>
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Service name</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="my-service"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cmd">Command</Label>
            <Input
              id="cmd"
              name="cmd"
              required
              placeholder="/usr/bin/my-app"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="args">Arguments</Label>
            <Input
              id="args"
              name="args"
              placeholder="--port 8080 --verbose"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="httpPort">HTTP Port</Label>
            <Input
              id="httpPort"
              name="httpPort"
              type="number"
              placeholder="8080"
              className="font-mono"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Creating..." : "Create Service"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
