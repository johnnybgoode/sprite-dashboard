# RC exec-saturation fix — Claude's independent plan (v1)

**Date:** 2026-05-26 · scratch (pre-reconciliation with teammate)

## Problem (from e2e smoke test)
`getRCStatus` runs a per-sprite `sprite.exec` every 5s for all warm/running sprites. The SDK opens a
fresh WebSocket per `exec()`, with **no timeout**. Under the 5s cadence, slow execs (5.5–30s) pile up →
exec-WS saturation → status execs abort at ~30s (false "inactive", button flaps) AND a user-initiated
stop exec stalls in CONNECTING **forever** (wedged >90s, task never deleted). Direct CLI exec is 0.2s, so
the sprite/command are fine — it's the dashboard's exec usage pattern + concurrency.

## Root causes (from SDK source)
1. **No timeout on exec WS.** `WSCommand.start()` (websocket.js:35) resolves only on `open`, rejects only
   on `error`. A connection stuck in CONNECTING (server refusing more) settles *never* → `execFile`'s
   promise hangs forever. The client `timeout:30000` applies to control-plane `fetch`, NOT the exec WS.
2. **One WS per exec, no pooling** (exec.js:198, websocket.js:42). N concurrent sprites × poll = N new WS / 5s.
3. **The /exec WS is one-shot** — command is in the URL query (`cmd`/`path`), runs once, closes on exit.
   Cannot multiplex multiple commands over one connection → "reuse the connection" doesn't apply to /exec.
4. **Wasted execs on warm sprites.** A keepalive task holds the sprite `running`; a `warm` sprite therefore
   *cannot* have an active task → RC is inactive by definition. Yet getRCStatus execs warm sprites too
   (this is the 30s engram exec we observed).
5. **UI:** single shared `useTransition` + `disabled={isPending}` → one slow action disables ALL action
   buttons across the whole table until reload.

## Fixes
### A. Bounded exec helper (`lib/sprites.ts`) — load-bearing
`execOnSprite(name, file, args, { timeoutMs })`: use `sprite.spawn(file, args, {})` (non-tty) to get the
`SpriteCommand` handle, accumulate stdout/stderr/exit (mirror execFile), but race a timeout; on timeout
call `cmd.kill()` (closes the WS) and reject a typed `ExecTimeoutError`. Guarantees every exec terminates.
Default ~10s. Route ALL RC task ops (get/add/delete) + any status exec through it.

### B. Per-sprite single-flight exec queue
Async mutex keyed by sprite name so ≤1 exec runs per sprite at a time. Prevents the poll from stacking
concurrent WS. Combined with (A) the worst case is bounded (≤ timeoutMs per queued op).

### C. Status without per-poll exec waste
`getRCStatus`: gate on control-plane status first. If `status !== 'running'` → inactive, **no exec**
(covers warm/cold/engram). Only when `running` → one bounded `sprite-task get` to confirm it's OUR task.
Pass the already-known status from the parent's `listSprites` so we don't re-`getSprite`.

### D. Poll cadence + client gate
Bump RC status poll 5s → 15s. In the parent, only call `getRCStatus` for sprites whose status is
`running` (skip warm) → warm sprites cost zero exec.

### E. UI per-action pending state
Replace the single `isPending` with a per-sprite (name→bool) pending map (or extract a per-row component)
so a slow/failed action disables only that row. Optimistically flip local state on success (stop → set
rcMap[name]=false immediately) so the button updates without waiting a poll.

### F. Stop reliability + idempotency
With (A), stop's delete is bounded (kills WS on timeout → `{ok:false,error}` instead of wedge). Make stop
idempotent: a "task already absent" outcome is success (fixes the flagged comment/code mismatch).

## Won't do
- Patch node_modules SDK (can't ship) — wrap instead.
- True WS multiplexing (endpoint is one-shot).

## Test (critical path)
Re-run e2e: engram (warm) → 0 exec; start → Active; **stop → task deleted promptly & reliably**; buttons
correct and never globally frozen; getRCStatus never wedges.
