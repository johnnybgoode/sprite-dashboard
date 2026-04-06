import { requireAuth } from "@/lib/dev-auth";
import { getSprite } from "@/lib/sprites";
import { getSession, setSession, deleteSession } from "@/lib/terminal-store";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

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
      try {
        let cmd;
        if (attachId) {
          cmd = sprite.attachSession(attachId);
        } else {
          cmd = sprite.createSession("bash", [], {
            tty: true,
            rows,
            cols,
            detachable: true,
          });
        }

        // Generate a session key for the store
        const sessionKey = `${name}:${Date.now()}`;
        setSession(sessionKey, cmd);

        // Send session info as first event
        controller.enqueue(
          encoder.encode(
            `event: session\ndata: ${JSON.stringify({ sessionKey })}\n\n`
          )
        );

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

        // Handle client disconnect
        request.signal.addEventListener("abort", () => {
          deleteSession(sessionKey);
        });
      } catch (error) {
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
