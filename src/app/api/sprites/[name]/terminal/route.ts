import { requireAuth } from "@/lib/dev-auth";
import { getSprite } from "@/lib/sprites";
import { getSession, setSession, deleteSession } from "@/lib/terminal-store";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const KEEPALIVE_INTERVAL_MS = 15_000;

// GET — SSE stream for terminal output
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const { name } = await params;
  const searchParams = request.nextUrl.searchParams;
  const rows = parseInt(searchParams.get("rows") ?? "24");
  const cols = parseInt(searchParams.get("cols") ?? "80");
  const attachId = searchParams.get("sessionId");

  const sprite = await getSprite(name);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

      try {
        let cmd;
        let spriteSessionId: string | undefined;

        if (attachId) {
          cmd = sprite.attachSession(attachId);
          spriteSessionId = attachId;
        } else {
          cmd = sprite.createSession("bash", [], {
            tty: true,
            rows,
            cols,
            detachable: true,
            env: { TERM: "xterm-256color" },
          });

          // Look up the session ID from the sprite so the client can reconnect
          try {
            const sessions = await sprite.listSessions();
            if (sessions.length > 0) {
              // Most recent session is the one we just created
              const latest = sessions[sessions.length - 1];
              spriteSessionId = latest.id;
            }
          } catch {
            // Non-fatal — reconnect just won't work
          }
        }

        // Generate a session key for the store
        const sessionKey = `${name}:${Date.now()}`;
        setSession(sessionKey, cmd);

        // Send session info as first event (include spriteSessionId for reconnect)
        controller.enqueue(
          encoder.encode(
            `event: session\ndata: ${JSON.stringify({ sessionKey, spriteSessionId })}\n\n`
          )
        );

        // Send keepalive comments to prevent proxy/browser timeout
        keepaliveTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {
            // stream closed
          }
        }, KEEPALIVE_INTERVAL_MS);

        // Pipe stdout
        cmd.stdout.on("data", (data: Buffer) => {
          try {
            const b64 = Buffer.from(data).toString("base64");
            controller.enqueue(
              encoder.encode(`event: data\ndata: ${b64}\n\n`)
            );
          } catch {
            // stream closed
          }
        });

        // Pipe stderr
        cmd.stderr.on("data", (data: Buffer) => {
          try {
            const b64 = Buffer.from(data).toString("base64");
            controller.enqueue(
              encoder.encode(`event: data\ndata: ${b64}\n\n`)
            );
          } catch {
            // stream closed
          }
        });

        // Handle exit
        cmd.wait().then((exitCode) => {
          if (keepaliveTimer) clearInterval(keepaliveTimer);
          try {
            controller.enqueue(
              encoder.encode(
                `event: exit\ndata: ${JSON.stringify({ exitCode })}\n\n`
              )
            );
            controller.close();
          } catch {
            // already closed
          }
          deleteSession(sessionKey);
        });

        // Handle client disconnect — clean up in-memory store but leave tmux session alive
        request.signal.addEventListener("abort", () => {
          if (keepaliveTimer) clearInterval(keepaliveTimer);
          deleteSession(sessionKey);
        });
      } catch (error) {
        if (keepaliveTimer) clearInterval(keepaliveTimer);
        const message =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// POST — stdin input and resize commands
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  await params; // consume params

  const body = await request.json();
  const { type, sessionKey, data, cols, rows } = body;

  const cmd = getSession(sessionKey);
  if (!cmd) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (type === "stdin" && data) {
    cmd.stdin.write(data);
  } else if (type === "resize" && cols && rows) {
    cmd.resize(cols, rows);
  }

  return Response.json({ ok: true });
}
