// Pin the WebSocket implementation the @fly/sprites SDK uses for `exec`.
// Node <22 has no native global WebSocket; the one Next injects is slow/flaky
// against the sprite exec endpoint (observed >25s + aborts), while undici's is a
// stable ~6s. Force undici's in the Node server runtime for predictable exec.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { WebSocket } = await import("undici");
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocket;
  }
}
