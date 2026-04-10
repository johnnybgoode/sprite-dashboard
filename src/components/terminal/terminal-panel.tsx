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
  const spriteSessionIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postToTerminal = useCallback(
    async (body: object) => {
      try {
        await fetch(`/api/sprites/${spriteName}/terminal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        // Network error — will be handled by SSE reconnect
      }
    },
    [spriteName]
  );

  const openSSE = useCallback(
    (
      term: import("@xterm/xterm").Terminal,
      fitAddon: import("@xterm/addon-fit").FitAddon,
      reconnect?: boolean
    ) => {
      // Close previous SSE if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const dims = fitAddon.proposeDimensions();
      const rows = dims?.rows ?? 24;
      const cols = dims?.cols ?? 80;

      let url = `/api/sprites/${spriteName}/terminal?rows=${rows}&cols=${cols}`;
      if (reconnect && spriteSessionIdRef.current) {
        url += `&sessionId=${encodeURIComponent(spriteSessionIdRef.current)}`;
      }

      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener("session", (e) => {
        const { sessionKey, spriteSessionId } = JSON.parse(e.data);
        sessionKeyRef.current = sessionKey;
        if (spriteSessionId) {
          spriteSessionIdRef.current = spriteSessionId;
        }
        reconnectAttemptsRef.current = 0;
        setConnected(true);
        setReconnecting(false);
        setError(null);
      });

      es.addEventListener("data", (e) => {
        const bytes = Uint8Array.from(atob(e.data), (c) => c.charCodeAt(0));
        term.write(bytes);
      });

      es.addEventListener("exit", () => {
        intentionalCloseRef.current = true;
        term.write("\r\n\x1b[90m[session ended]\x1b[0m\r\n");
        setConnected(false);
        setReconnecting(false);
      });

      es.addEventListener("error", (e) => {
        if (e instanceof MessageEvent) {
          const { message } = JSON.parse(e.data);
          setError(message);
          intentionalCloseRef.current = true;
        }
        setConnected(false);
      });

      es.onerror = () => {
        if (intentionalCloseRef.current) return;

        es.close();
        setConnected(false);

        // Attempt reconnect with exponential backoff (max 10s)
        const attempts = reconnectAttemptsRef.current;
        if (attempts < 20) {
          const delay = Math.min(1000 * Math.pow(1.5, attempts), 10000);
          setReconnecting(true);
          term.write(
            `\r\n\x1b[90m[connection lost — reconnecting in ${Math.round(delay / 1000)}s...]\x1b[0m\r\n`
          );
          reconnectTimerRef.current = setTimeout(() => {
            reconnectAttemptsRef.current = attempts + 1;
            openSSE(term, fitAddon, true);
          }, delay);
        } else {
          setReconnecting(false);
          term.write(
            "\r\n\x1b[90m[connection lost — click Connect to start a new session]\x1b[0m\r\n"
          );
        }
      };
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
    intentionalCloseRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
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

    // Reset reconnect state
    intentionalCloseRef.current = false;
    reconnectAttemptsRef.current = 0;

    // Open SSE connection (new session)
    openSSE(term, fitAddon);

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
  }, [openSSE, postToTerminal]);

  // Proactively reconnect when tab regains visibility (common on mobile)
  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        spriteSessionIdRef.current &&
        termRef.current &&
        fitAddonRef.current &&
        !intentionalCloseRef.current
      ) {
        const es = eventSourceRef.current;
        if (!es || es.readyState === EventSource.CLOSED) {
          reconnectAttemptsRef.current = 0;
          openSSE(termRef.current, fitAddonRef.current, true);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [openSSE]);

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      eventSourceRef.current?.close();
      termRef.current?.dispose();
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          onClick={connect}
          variant="outline"
          size="sm"
          disabled={connected || reconnecting}
        >
          <TerminalIcon className="mr-2 h-4 w-4" />
          {connected ? "Connected" : reconnecting ? "Reconnecting..." : "Connect Terminal"}
        </Button>
        {connected && (
          <span className="inline-flex items-center gap-1.5 text-xs text-terminal-green">
            <span className="h-2 w-2 rounded-full bg-terminal-green animate-pulse" />
            Live
          </span>
        )}
        {reconnecting && (
          <span className="inline-flex items-center gap-1.5 text-xs text-terminal-yellow">
            <span className="h-2 w-2 rounded-full bg-terminal-yellow animate-pulse" />
            Reconnecting
          </span>
        )}
        {error && (
          <span className="text-xs text-terminal-red">{error}</span>
        )}
      </div>
      <div
        ref={containerRef}
        className="h-[400px] w-full rounded-md border bg-[#0a0a0a] p-1 max-md:h-[300px]"
      />
    </div>
  );
}
