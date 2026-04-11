# Remote Control Session Management

## Problem

Clicking "RC" in the dashboard runs `claude --remote-control` on a sprite via `execCommand`, but the sprite goes cold as soon as the exec call returns. The user needs the sprite to stay warm so they can connect from the Claude mobile app.

Sprites stay warm based on active inbound connections, not running processes. So we need a persistent connection from the server to the sprite for the duration of the RC session.

## Solution

A long-lived Next.js API route holds a WebSocket connection to the sprite, keeping it warm. The user's phone can close the dashboard tab freely — the keepalive runs server-side on Vercel.

## Architecture

### API Route: `/api/sprites/[name]/rc`

Three methods on a single route:

- **POST** — Start an RC session
  1. Call `sprite.createSession("claude", ["--dangerously-skip-permissions", "--remote-control"])` 
  2. Call `cmd.start()` to open the WebSocket
  3. Store the `SpriteCommand` reference in an in-memory map keyed by sprite name
  4. Set an auto-timeout timer (default: 2 hours)
  5. Return `{ active: true, startedAt, timeoutAt }`

- **GET** — Check session status
  1. Look up sprite name in the session map
  2. Return `{ active: boolean, startedAt?, timeoutAt? }`

- **DELETE** — Stop an RC session
  1. Look up the `SpriteCommand` in the map
  2. Call `cmd.kill()` to close the WebSocket
  3. Clear the timeout timer
  4. Remove from map
  5. Return `{ active: false }`

### Session Map

A module-level `Map<string, { cmd: SpriteCommand, timer: NodeJS.Timeout, startedAt: string, timeoutAt: string }>`. 

This lives in-memory on the Vercel function instance. Single user, single session per sprite — no need for external state. If the function instance recycles, the WS drops and the sprite goes cold, which is acceptable (same as closing a terminal).

### Auto-Timeout

On session creation, schedule a timer that calls `cmd.kill()` after the configured duration (default 2 hours). This prevents runaway usage if the user forgets to stop the session. The timeout value is hardcoded for MVP; could be configurable later.

### Vercel Function Duration

The POST handler needs to return a response while the WebSocket stays open in the background. The session map and WebSocket live in the module scope, not tied to the request lifecycle. The function instance stays alive as long as there's an active connection.

**Open question:** Vercel's max function duration may cap how long the instance lives. The user is checking their plan limits. If the limit is shorter than 2 hours, we can implement a renewal mechanism (client polls and the server extends the keepalive) or reduce the default timeout.

## UI Changes

### Sprite Table — RC Button States

The RC button in the Actions column reflects session state:

| State | Appearance | Click Action |
|-------|-----------|-------------|
| Idle | "RC" + Play icon | POST to start session |
| Starting | Spinner, disabled | — |
| Active | "Stop RC" + Square icon, destructive style | DELETE to stop session |

### Polling

The sprite table (or SpritesPageClient) polls RC status for each sprite every 5 seconds, same cadence as the existing sprite list refresh. This keeps the button state current across tabs/devices.

Implementation: a new server action `getRCStatus(spriteName)` that calls the GET endpoint, integrated into the existing polling loop in `SpritesPageClient`.

## Files to Create/Modify

### New Files
- `src/app/api/sprites/[name]/rc/route.ts` — API route with GET/POST/DELETE handlers
- `src/lib/rc-sessions.ts` — Session map and timeout management (module-level singleton)

### Modified Files
- `src/app/actions/remote-control.ts` — Rewrite to call the API route instead of `execCommand`
- `src/components/sprites/sprite-table.tsx` — Update RC button to show state and toggle start/stop
- `src/components/sprites/sprites-page-client.tsx` — Add RC status polling alongside provisioning polling

### Files to Remove
- `playbooks/sprites/roles/remote-control/` — No longer needed; session is created via SDK, not `start-rc.sh`

## Non-Goals (MVP)

- Displaying the magic link / QR code — the Claude app discovers sessions automatically
- Multiple concurrent sessions per sprite
- Configurable timeout (hardcoded 2h)
- `--continue` flag support
- Persisting session state across Vercel instance restarts
