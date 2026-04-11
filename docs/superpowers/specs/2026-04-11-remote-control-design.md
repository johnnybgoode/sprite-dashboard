# Remote Control Session Management

## Problem

Clicking "RC" in the dashboard runs `claude --remote-control` on a sprite via `execCommand` (which calls `sprite.exec()`), but the sprite goes cold as soon as the exec call returns. The user needs the sprite to stay warm so they can connect from the Claude mobile app.

## Solution — Phased

### Phase 1: Switch to `createSession` (this phase)

Replace `execCommand` with `sprite.createSession()` which creates a detachable tmux session on the sprite. The session persists independently of the API call. Test whether the active Claude process alone keeps the sprite warm.

### Phase 2: Ping relay keepalive (if needed)

If the sprite still goes cold despite an active session, add a browser-side ping relay: a `setInterval` (every 3-4 minutes) that calls a serverless function which does a no-op `sprite.exec("true")` to reset the sprite's idle timer. Auto-stops after 2 hours.

This avoids both Vercel's 5-minute function duration limit (each ping is a fresh invocation) and iOS WebSocket suspension risk (a timer is more resilient than a persistent WS).

## Phase 1 Architecture

### Server Action: `startRemoteControl`

Rewrite `src/app/actions/remote-control.ts`:

1. Get the sprite via `getSprite(name)`
2. Call `sprite.createSession("claude", ["--dangerously-skip-permissions", "--remote-control"])` to get a `SpriteCommand`
3. Call `cmd.start()` to initiate the session
4. Don't await `cmd.wait()` — let it run detached
5. Return `{ ok: true }`

### Server Action: `stopRemoteControl`

New action that kills the RC session:

1. Get the sprite via `getSprite(name)`
2. Call `sprite.listSessions()` to find the active session
3. Kill the session (or exec `tmux kill-session -t claude`)
4. Return `{ ok: true }`

### Server Action: `getRCStatus`

New action to check if an RC session is active:

1. Get the sprite via `getSprite(name)` 
2. Call `sprite.listSessions()`
3. Return `{ active: boolean }` based on whether a claude session exists

### UI: RC Button States

The RC button in the Actions column reflects session state:

| State | Appearance | Click Action |
|-------|-----------|-------------|
| Idle | "RC" + Play icon | Calls `startRemoteControl` |
| Starting | Spinner, disabled | — |
| Active | "Stop RC" + Square icon, destructive style | Calls `stopRemoteControl` |

### Polling

The sprite table polls `getRCStatus` for each sprite every 5 seconds (same cadence as existing list refresh). Integrated into the existing polling in `SpritesPageClient`.

## Files to Create/Modify

### Modified Files
- `src/app/actions/remote-control.ts` — Rewrite to use `createSession` + add `stopRemoteControl` and `getRCStatus`
- `src/components/sprites/sprite-table.tsx` — RC button shows state, toggles start/stop
- `src/components/sprites/sprites-page-client.tsx` — Add RC status polling

### Keep (for now)
- `playbooks/sprites/roles/remote-control/` — Keep `start-rc.sh` as a fallback; doesn't hurt to have it provisioned

## Non-Goals (Phase 1)

- Server-side keepalive (blocked by Vercel 5m limit)
- Ping relay (Phase 2 if needed)
- Magic link display
- Auto-timeout (Phase 2)
- Multiple sessions per sprite
