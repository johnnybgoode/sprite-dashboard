"use client";

import { Badge } from "@/components/ui/badge";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function ExecOutput({ result }: { result: ExecResult | null }) {
  if (!result) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground font-mono text-xs">
          exit code
        </span>
        <Badge variant={result.exitCode === 0 ? "default" : "destructive"}>
          {result.exitCode}
        </Badge>
      </div>
      {result.stdout && (
        <pre className="whitespace-pre-wrap font-mono text-sm text-terminal-green">
          {result.stdout}
        </pre>
      )}
      {result.stderr && (
        <pre className="whitespace-pre-wrap font-mono text-sm text-terminal-red">
          {result.stderr}
        </pre>
      )}
    </div>
  );
}
