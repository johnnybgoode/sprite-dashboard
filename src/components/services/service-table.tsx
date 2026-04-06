"use client";

import { useTransition } from "react";
import type { ServiceInfo } from "@/lib/sprites";
import {
  startService,
  stopService,
  deleteService,
  signalService,
} from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, Square, Trash2, Zap } from "lucide-react";
import { CreateServiceSheet } from "./create-service-sheet";

const SIGNALS = ["SIGTERM", "SIGKILL", "SIGHUP", "SIGUSR1"];

function ServiceRow({
  service,
  spriteName,
}: {
  service: ServiceInfo;
  spriteName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const isRunning = service.state?.status === "running";

  function handleToggle() {
    startTransition(async () => {
      if (isRunning) {
        await stopService(spriteName, service.name);
      } else {
        await startService(spriteName, service.name);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteService(spriteName, service.name);
    });
  }

  function handleSignal(signal: string) {
    startTransition(async () => {
      await signalService(spriteName, service.name, signal);
    });
  }

  return (
    <TableRow className={isPending ? "opacity-50" : undefined}>
      <TableCell className="font-mono">{service.name}</TableCell>
      <TableCell className="font-mono max-w-[200px] truncate">
        {service.config.cmd}
        {service.config.args?.length
          ? ` ${service.config.args.join(" ")}`
          : ""}
      </TableCell>
      <TableCell>
        <Badge
          variant={isRunning ? "default" : "secondary"}
          className={isRunning ? "bg-green-600 hover:bg-green-600" : ""}
        >
          {service.state?.status ?? "stopped"}
        </Badge>
      </TableCell>
      <TableCell className="font-mono">
        {service.config.httpPort ?? "-"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            disabled={isPending}
            title={isRunning ? "Stop" : "Start"}
          >
            {isRunning ? (
              <Square className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending || !isRunning}
                title="Send signal"
              >
                <Zap className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SIGNALS.map((sig) => (
                <DropdownMenuItem key={sig} onClick={() => handleSignal(sig)}>
                  {sig}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete service</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete{" "}
                  <span className="font-mono font-semibold">
                    {service.name}
                  </span>
                  ? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function ServiceTable({
  spriteName,
  services,
}: {
  spriteName: string;
  services: ServiceInfo[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Services</h2>
        <CreateServiceSheet spriteName={spriteName} />
      </div>

      {services.length === 0 ? (
        <div className="text-muted-foreground font-mono text-sm py-8 text-center">
          No services configured
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Command</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HTTP Port</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <ServiceRow
                  key={service.name}
                  service={service}
                  spriteName={spriteName}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
