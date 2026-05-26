# Relay API Contract — Dashboard ↔ Remote-Control Relay

**Status:** draft · **Date:** 2026-05-25

This document defines the boundary between the **sprite-dashboard PWA** and the **remote-control
relay service**. The relay runs on an always-on home server on the tailnet; it starts
`claude --remote-control` on a sprite (detached) and keeps the sprite warm via the sprites.dev Tasks
API heartbeat (sprites auto-sleep when idle). The relay's internal implementation — including how it
runs the heartbeat — is out of scope here; only the wire contract is specified.

```
PWA  --(POST start)-->        relay  --(start session + Tasks heartbeat)-->  sprite
PWA  <--(success / error)--   relay
PWA  --(get status, poll)-->  sprite        (status indicator only; NOT the keepalive)
```

The status indicator is derived directly from the sprite (existing `getRCStatus`) and does **not**
go through the relay; it is therefore not part of this contract.

## Transport & conventions

- **Base URL:** `https://<relay-host>.<tailnet>.ts.net`, served via `tailscale serve` (valid
  Let's Encrypt cert — no mixed-content issue from the HTTPS PWA). The dashboard reads it from
  `NEXT_PUBLIC_RELAY_URL`. The URL is not secret.
- **Auth:** none at the application layer — **no `Authorization` header, no shared secret**. The
  relay is reachable only over the tailnet (behind `tailscale serve`) and authorizes the request by
  the caller's **Tailscale identity** at the network layer. Browser-direct calls originate from the
  user's own tailnet device, so the relay sees that device's identity. A caller whose identity is
  not permitted gets `403`. **The relay MUST NOT be exposed via Tailscale Funnel** — that would
  remove the only authentication boundary.
- **Content-Type:** `application/json` for request and response bodies.
- **Response envelope:** `{ "ok": boolean, "error"?: string }`.
- **Versioning:** `/v1` prefix; additive changes only within `v1`.

### CORS (required)

The PWA is served from a different origin (Vercel), so the relay MUST:

- handle `OPTIONS` preflight,
- return `Access-Control-Allow-Origin: <dashboard origin>`,
- `Access-Control-Allow-Headers: Content-Type`,
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`.

## Endpoints

### `POST /v1/sprites/{name}/rc/start`

Ensure a `claude --remote-control` session is running on sprite `{name}` and hold a persistent
connection to keep it warm. **Idempotent** — if already running/held, returns `ok: true`. The relay
responds only after the session is confirmed started, so the result is meaningful. Cold-start can
take several seconds; clients should use a generous timeout (~30s).

Request body: none required (sprite identified by path).

| Status | Body | Meaning |
|--------|------|---------|
| `200` | `{ "ok": true }` | Started, or already active |
| `400` | `{ "ok": false, "error": "..." }` | Bad request |
| `403` | — | Caller's Tailscale identity not permitted |
| `404` | `{ "ok": false, "error": "sprite not found" }` | Unknown sprite |
| `502` | `{ "ok": false, "error": "..." }` | Upstream sprites API / start failure |
| `500` | `{ "ok": false, "error": "..." }` | Relay internal error |

### `POST /v1/sprites/{name}/rc/stop`

Release the held connection and kill the RC session on sprite `{name}`. Idempotent.

| Status | Body |
|--------|------|
| `200` | `{ "ok": true }` |
| `403` / `404` / `502` / `500` | `{ "ok": false, "error": "..." }` (as above) |

### `GET /healthz`

Liveness check so the dashboard can detect an unreachable relay and surface it. No auth.

| Status | Body |
|--------|------|
| `200` | `{ "ok": true }` |

## Client usage (dashboard)

```ts
// src/lib/relay.ts — runs in the browser, no auth header
const base = process.env.NEXT_PUBLIC_RELAY_URL!;

async function rc(name: string, action: "start" | "stop") {
  const res = await fetch(`${base}/v1/sprites/${name}/rc/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? `relay ${action} failed (status ${res.status})`);
  }
}

export const startRemoteControl = (name: string) => rc(name, "start");
export const stopRemoteControl = (name: string) => rc(name, "stop");
```
