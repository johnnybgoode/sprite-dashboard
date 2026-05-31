"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { execCommand } from "@/app/actions/terminal";
import { ExecOutput, type ExecResult } from "./exec-output";

export function ExecBar({ spriteName }: { spriteName: string }) {
  const [command, setCommand] = useState("");
  const [result, setResult] = useState<ExecResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim()) return;

    startTransition(async () => {
      const res = await execCommand(spriteName, command.toLowerCase());
      setResult(res);
    });
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <span className="font-mono text-terminal-green text-sm shrink-0">
              $
            </span>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Enter command..."
              disabled={isPending}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="font-mono bg-background border-border lowercase"
            />
            <Button type="submit" disabled={isPending || !command.trim()}>
              {isPending ? "Running..." : "Run"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <ExecOutput result={result} />
    </div>
  );
}
