"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { TerminalIcon } from "lucide-react";

export function TerminalPanel({ spriteName }: { spriteName: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionKeyRef = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postToTerminal = useCallback(
    async (body: object) => {
      await fetch(`/api/sprites/${spriteName}/terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    [spriteName]
  );

  const connect = useCallback(async () => {
    if (!containerRef.current) return;

    // Dynamic imports (xterm is browser-only)
    const { Terminal } = await import("@xterm/xterm");
    const { FitAddon } = await import("@xterm/addon-fit");
    const { WebLinksAddon } = await import("@xterm/addon-web-links");

    // Load xterm CSS
    await import("@xterm/xterm/css/xterm.css");

    // Clean up previous
    if (termRef.current) {
      termRef.current.dispose();
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Geist Mono", monospace',
      theme: {
        background: "#0a0a0a",
        foreground: "#ededed",
        cursor: "#ededed",
        selectionBackground: "#3b3b3b",
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const dims = fitAddon.proposeDimensions();
    const rows = dims?.rows ?? 24;
    const cols = dims?.cols ?? 80;

    // Open SSE connection
    const es = new EventSource(
      `/api/sprites/${spriteName}/terminal?rows=${rows}&cols=${cols}`
    );
    eventSourceRef.current = es;

    es.addEventListener("session", (e) => {
      const { sessionKey } = JSON.parse(e.data);
      sessionKeyRef.current = sessionKey;
      setConnected(true);
      setError(null);
    });

    es.addEventListener("data", (e) => {
      const bytes = Uint8Array.from(atob(e.data), (c) => c.charCodeAt(0));
      term.write(bytes);
    });

    es.addEventListener("exit", () => {
      term.write("\r\n\x1b[90m[session ended]\x1b[0m\r\n");
      setConnected(false);
    });

    es.addEventListener("error", (e) => {
      if (e instanceof MessageEvent) {
        const { message } = JSON.parse(e.data);
        setError(message);
      }
      setConnected(false);
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setConnected(false);
      }
    };

    // Handle keyboard input
    term.onData((data) => {
      if (sessionKeyRef.current) {
        postToTerminal({
          type: "stdin",
          sessionKey: sessionKeyRef.current,
          data,
        });
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const newDims = fitAddon.proposeDimensions();
      if (newDims && sessionKeyRef.current) {
        postToTerminal({
          type: "resize",
          sessionKey: sessionKeyRef.current,
          cols: newDims.cols,
          rows: newDims.rows,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [spriteName, postToTerminal]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      termRef.current?.dispose();
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button onClick={connect} variant="outline" size="sm" disabled={connected}>
          <TerminalIcon className="mr-2 h-4 w-4" />
          {connected ? "Connected" : "Connect Terminal"}
        </Button>
        {connected && (
          <span className="inline-flex items-center gap-1.5 text-xs text-terminal-green">
            <span className="h-2 w-2 rounded-full bg-terminal-green animate-pulse" />
            Live
          </span>
        )}
        {error && (
          <span className="text-xs text-terminal-red">{error}</span>
        )}
      </div>
      <div
        ref={containerRef}
        className="h-[400px] w-full rounded-md border bg-[#0a0a0a] p-1"
      />
    </div>
  );
}
