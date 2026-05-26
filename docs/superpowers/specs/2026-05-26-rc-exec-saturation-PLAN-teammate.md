# RC exec saturation & UI freeze — fix plan (teammate)

Date: 2026-05-26
Author: design partner (independent plan)
Status: reconciled round 2 — see "Reconciliation (round 2)" at the bottom for the agreed decisions. The original proposal above is preserved for audit.

## TL;DR

Two independent defects compound:

1. **The SDK exec/WebSocket path has no timeout and a broken reject path, so a stalled
   `exec()` can hang for ~30s (undici handshake timeout) or effectively forever (>90s wedge)
   with the promise never settling.** Our code awaits these execs directly in server actions
   and in a per-row poll, so a single slow sprite stalls a whole poll cycle, and a wedged
   `stop` never returns.
2. **The UI uses one shared `useTransition` for every action in the whole table**, so any
   pending/wedged action disables every button in every row until a reload.

Fix = (a) wrap every `sprite.exec()` we issue in our own `Promise.race` timeout + abort,
(b) stop blocking the poll on exec for status — debounce/serialize and isolate failures,
(c) give the UI per-row pending state, and (d) make `stopRemoteControl` resilient (timeout +
report "couldn't confirm" rather than hang). Connection reuse is **not** a viable fix (see below).

---

## Root cause analysis (grounded in SDK source)

### A. The exec WebSocket has no timeout anywhere

`node_modules/@fly/sprites/dist/exec.js` and `websocket.js`: a `grep` for
`timeout|setTimeout|AbortSignal|abort` returns **nothing**. Compare with the control-plane
HTTP calls in `client.js` and `sprite.js`, which all set `signal: AbortSignal.timeout(...)`
(`client.js:53, 84, 122, 138, 164`; `sprite.js:73, 148, 171`). The exec path is the one
family of calls with **no deadline**.

Flow for `sprite.exec("sprite-task get ...")`:
- `Sprite.exec` → `exec()` (`exec.js:184`) → `execFile()` (`exec.js:194`) returns a Promise
  that only ever settles on `cmd.on('exit')` (`exec.js:219`) or `cmd.on('error')`
  (`exec.js:235`), or `cmd.start().catch(reject)` (`exec.js:238`).
- `cmd.start()` (`exec.js:44`) → `this.wsCmd.start()` (`websocket.js:35`).
- `WSCommand.start()` resolves on the WS `open` event (`websocket.js:46-48`). It only
  *settles* `execFile`'s promise indirectly: `start()` resolving lets `execFile` keep waiting
  for `exit`; the promise resolves later when the `Exit` stream frame arrives
  (`websocket.js:105-108` → `close()` → `handleClose` → `emit('exit')` → `exec.js:219`).

So the `execFile` promise resolves **only** when the server sends a binary `Exit` frame
(`StreamID.Exit`, `websocket.js:105`) or the socket closes. If the command runs but the
sprite never flushes an Exit frame, or the socket half-opens and stalls, **nothing settles
the promise**. There is no timer to force it.

### B. The `start()` reject guard is dead code → handshake/early errors never reject

`websocket.js:39` sets `this.started = true` **before** constructing the Promise. The error
listener at `websocket.js:49-55`:

```js
this.ws.addEventListener('error', () => {
    const error = new Error('WebSocket error');
    this.emit('error', error);
    if (!this.started) {   // <-- always false; started was set at line 39
        reject(error);
    }
});
```

`!this.started` is **always false**, so `start()`'s promise **never rejects** on a WS error.
The `emit('error')` does propagate to `execFile`'s `cmd.on('error')` (`exec.js:235`) — *if*
a listener is attached in time — so a clean connection-refused does surface. But there is no
deadline: a TCP connect that hangs (SYN with no response, or TLS that stalls) produces
neither `open` nor `error` promptly. undici's WebSocket falls back to its connect/headers
timeout (~30s by default for the upgrade), which is exactly the **"exactly ~30s, `aborted`"**
we observed. The **>90s wedge** on `stop` is the worse tail: the upgrade *succeeded* (socket
open, `start()` resolved) but no `Exit` frame ever arrived for that particular exec, so
`execFile` waits with no timer → unbounded hang. Note `aborted` is undici's wording; it is
the SDK's *missing* abort, not ours.

### C. One WebSocket per exec, no pooling, no multiplexing

Every `SpriteCommand` constructs a fresh `WSCommand` with a fresh `new WebSocket(url)`
(`exec.js:31`, `websocket.js:42`). The URL is per-command: the command + args are baked into
query params (`exec.js:100-106`, `/v1/sprites/<name>/exec?cmd=...`). There is no shared socket,
no command queue, no request-id framing. The wire protocol is single-command: byte 0 is a
`StreamID` (Stdin/Stdout/Stderr/Exit/StdinEOF, `websocket.js:96-108`) with **no command/stream
multiplexing id**. One connection = one command, full stop.

### D. How A–C produce the observed symptoms in *our* code

- **Poll saturation (5.5s healthy / ~30s timeout, both sprites, every 5s):**
  `sprites-page-client.tsx:46-51` fires `getRCStatus(s.name)` for *every* warm/running sprite
  in parallel each tick. Each `getRCStatus` (`remote-control.ts:96`) does a fresh
  `sprite.exec("sprite-task get remote-control")` = a fresh WS upgrade + spawn of
  `sprite-task` inside the sprite. ~5.5s is the *healthy* cost of (WS upgrade + cold-ish
  `sprite-task` exec round trip); ~30s is undici's upgrade timeout when the exec backend is
  saturated. Because the poll interval (5s) is **shorter than the healthy exec latency
  (5.5s)**, ticks overlap and pile up: each tick opens N new sockets before the previous
  tick's sockets closed, monotonically increasing concurrent exec sessions on the sprite
  until the exec backend can't accept new upgrades → everything tips into the 30s-timeout
  regime. This is a self-inflicted thundering-herd, *amplified* by the missing client timeout.
- **`stopRemoteControl` wedges >90s:** `remote-control.ts:76` awaits
  `sprite.exec("sprite-task delete ...")`. If that exec's socket opens but the Exit frame is
  lost (plausible under the saturation above), there is no timer → the server action never
  returns → the client `startTransition` never completes → `isPending` stays true forever.
  The same delete via the `sprite` CLI taking 0.204s confirms the sprite/command are fine; the
  failure is the SDK exec path under our load pattern.
- **UI global freeze:** `sprite-table.tsx:43` is a single `const [isPending, startTransition]
  = useTransition()`. Every handler (`handleStop`, `handleStartRC`, `handleStopRC`) runs
  through that one `startTransition`, and every button is `disabled={isPending}`
  (lines 149, 159, 168). One wedged action ⇒ entire table frozen until reload.

---

## The "reuse the WebSocket connection" hypothesis — rejected

Tempting, but **not feasible** against this `/exec` protocol, and it wouldn't even fix the
core bug:

1. **Protocol is one-command-per-connection.** The command is in the URL query string
   (`exec.js:100-106`); you cannot send a second command over an open socket. The frame
   format (`websocket.js:96-108`) carries a single `StreamID` byte with no stream/command id,
   so there's no multiplexing channel to add a second concurrent command. To reuse a socket
   you'd need a server protocol change we don't control.
2. **`createSession`/`attachSession` don't help for status/delete.** They open a *TTY* tmux
   session (`sprite.js:47-63`, `tty:true`), which switches `WSCommand` into TTY mode where
   output is raw terminal bytes and exit is inferred from the close code
   (`websocket.js:119-123`) — you can't cleanly capture `sprite-task get` stdout or a real
   exit code through a shared interactive shell without brittle prompt-scraping. That's a
   regression in reliability, not an improvement.
3. **It doesn't address the actual defect.** The wedge is "promise never settles," and the
   poll storm is "we issue too many execs too often with no deadline." Connection reuse
   changes neither the missing timeout nor our polling cadence. Even a perfect pool would
   still hang on a lost Exit frame.

Conclusion: do not pursue socket reuse. Reduce *how often/how many* execs we issue, and put a
hard deadline on each one.

---

## Fixes

### Fix 1 — A hard-deadline exec wrapper (the keystone)
**New file:** `src/lib/sprite-exec.ts`

Add `execWithTimeout(sprite, command, { timeoutMs })` that wraps `sprite.exec` (or `spawn`)
in `Promise.race` against a timer, and on timeout calls `cmd.kill()` to close the socket
(`exec.js:152` → `wsCmd.close()`), so we never leak a hung socket. Prefer using `spawn` +
manual buffering so we own the `SpriteCommand` handle and can `.kill()` it; `exec()`/
`execFile()` don't return the handle. Signature:

```ts
export async function execWithTimeout(
  sprite: Sprite, command: string, opts?: { timeoutMs?: number }
): Promise<{ stdout: string; stderr: string; exitCode: number }>
```

- Default `timeoutMs`: 8000 for status reads, configurable.
- On timeout: `cmd.kill()`, then reject with a typed `ExecTimeoutError` (so callers can
  distinguish "timed out / unknown" from "ran and returned").
- Guard the `'error'`/`'exit'` listeners so they're attached before `start()` (mirror
  `execFile`'s ordering) to avoid the missed-error race.

This neutralizes defect A and B from our side without patching node_modules.

### Fix 2 — `remote-control.ts`: use the wrapper + correct semantics
- `getRCStatus`: call `execWithTimeout(sprite, "sprite-task get remote-control", {timeoutMs:
  8000})`. On timeout/error, **do not** silently return `{active:false}` (that's a lie that
  flips the button to "RC" mid-session). Return a third state — change the contract to
  `{ active: boolean; unknown?: boolean }` and return `{active:false, unknown:true}` on
  timeout so the UI can render "RC" disabled / a neutral state rather than a confident "off".
  (At minimum, keep the *last known* value rather than forcing false.)
- `stopRemoteControl`: `execWithTimeout(..., {timeoutMs: 10000})`. On success report ok; on
  timeout return `{ok:false, error:"Could not confirm task deletion (exec timed out)"}` —
  the action *returns* instead of wedging, so the transition completes and the UI recovers.
  Optionally verify with a follow-up `sprite-task get` to report real success.
- `startRemoteControl`: same wrapper on the `tmux has-session` check (`remote-control.ts:22`)
  and the `sprite-task add` (`remote-control.ts:55`). The detached `createSession` itself is
  fine (fire-and-forget, already not awaited).

### Fix 3 — Stop the poll from being a thundering herd
**File:** `src/components/sprites/sprites-page-client.tsx`

- **Serialize, don't overlap.** Replace the fixed `setInterval(…, 5000)` (lines 60-66) with a
  self-scheduling loop: run `refreshRC`, and only `setTimeout` the next run *after* it settles
  (plus a floor, e.g. `max(5000, elapsed)`), so a 5.5s cycle can't stack on the next tick.
- **Raise the RC-status cadence.** RC status changes rarely (user-initiated). Poll
  `getRCStatus` far less often than `listSprites` — e.g. status every 5s (cheap HTTP), RC
  every 20–30s, or only on demand / right after a start/stop. This alone removes most exec
  load.
- **Bound concurrency.** If we keep per-sprite RC checks, cap parallelism (e.g. a small
  `p-limit`-style gate of 2–3) instead of `Promise.all` over every sprite at once
  (lines 46-51), so we never open N sockets simultaneously.
- **Don't drop the map on partial failure.** `setRcMap(statuses)` (line 53) replaces the
  whole map each tick; one slow sprite that returns `unknown` shouldn't blank others. Merge
  into prior state and keep last-known on `unknown`.

(There is also a *second*, redundant `listSprites` poll inside `sprite-table.tsx:46-51`
running its own 5s interval, in addition to the one in `sprites-page-client.tsx`. Consolidate
to a single source of truth — the table already receives `initialSprites`/`rcMap` as props,
so the table's own interval is redundant and should be removed.)

### Fix 4 — Per-row UI pending state (kill the global freeze)
**File:** `src/components/sprites/sprite-table.tsx`

- Remove the single shared `useTransition` (line 43) as the disable source. Track pending
  per row+action, e.g. `const [pending, setPending] = useState<Record<string, "stop" |
  "rc-start" | "rc-stop" | undefined>>({})` keyed by sprite name. Each handler sets its own
  row's pending before the await and clears it after (in `finally`).
- Buttons disable on *their own* row's pending only (`disabled={pending[name] !== undefined}`),
  not a global flag. This means a wedged action on sprite A leaves sprite B fully usable.
- We can keep `useTransition` purely for the non-urgent `setSprites` state update if desired,
  but it must not gate `disabled`.
- Because Fix 2 makes the actions *always settle* (timeout), the `finally` always clears
  pending — no more "frozen until reload."

---

## Trade-offs, risks, and non-goals

- **Not patching `node_modules/@fly/sprites`.** It's a dependency; a fork/patch is a
  maintenance burden and the wrapper achieves the same client-side guarantee. We should file
  an upstream issue: (1) no exec timeout, (2) dead `if (!this.started)` reject guard at
  `websocket.js:52`, (3) `execFile` promise can never settle if no Exit frame. Trade-off: our
  `kill()` closes the socket but the *server-side* process may linger; acceptable for
  idempotent reads (`sprite-task get`) and for delete (re-runnable).
- **`{unknown}` status complicates the UI** vs. the simpler "assume off." I deliberately
  choose correctness: silently flipping to "off" mid-session (current `catch {} → false`,
  `remote-control.ts:98-100`) is a worse UX than a brief neutral/last-known state.
- **Lower RC poll cadence** means up to ~20–30s lag reflecting an externally-changed task.
  Acceptable; RC is user-initiated from this same UI, and we can optimistically update on
  start/stop.
- **Won't pursue connection reuse / session multiplexing** (rejected above).
- **Won't move tasks to a control-plane HTTP call** — confirmed by docs + SDK that no such
  endpoint exists (`sprite.js` has no tasks method; docs make no mention). exec is the only
  channel; we make exec safe instead.
- **Risk: timeout too aggressive.** Healthy status exec is ~5.5s today, so an 8s status
  timeout is tight. But ~5.5s is itself a *symptom* of saturation; after Fixes 3 it should
  drop. Make timeouts env-configurable and start generous (status 8–10s, mutations 12–15s),
  then tighten.

---

## How I'd test the critical path

1. **Unit / integration on the wrapper** (`src/lib/sprite-exec.ts`): inject a fake `Sprite`
   whose `spawn` returns a `SpriteCommand`-like stub. Cases: (a) normal exit → resolves with
   stdout/exit 0; (b) never emits exit → `execWithTimeout` rejects with `ExecTimeoutError`
   within `timeoutMs` and calls `kill()` (assert kill invoked); (c) emits `error` → rejects.
   This directly pins defects A/B.
2. **Server-action tests** for `getRCStatus`/`stopRemoteControl` with the wrapper mocked:
   timeout → `getRCStatus` returns `{active:false, unknown:true}` (not a confident false);
   `stopRemoteControl` returns `{ok:false, error: "...timed out"}` and *returns* (assert it
   resolves, with a test timeout well under the old 90s).
3. **Live e2e smoke (re-run the original).** Against a warm sprite: time `getRCStatus`
   under the new serialized/bounded poll — assert no overlapping cycles, exec latency trends
   down, no `aborted`/30s entries in the dev log. Then start RC, confirm task registered,
   click Stop RC and assert it completes < timeout and the task is actually gone
   (`sprite-task get` via CLI as oracle, matching the 0.204s baseline).
4. **UI isolation test** (Playwright): start a deliberately slow/wedged action on sprite A
   (point at a sprite that stalls, or stub the action with a delay) and assert sprite B's RC/
   Stop buttons remain enabled and clickable — i.e., no global freeze.
5. **Regression guard:** assert there is exactly one polling source for `listSprites` (the
   table's redundant interval removed).

---

## Reconciliation (round 2)

Reconciling with Claude's plan. Source re-verified this round:
`client.js:47-65` (getSprite), `client.js:95-112` (listAllSprites), `sprite.js:8-30`
(Sprite.status / spawn), `exec.js:170-240` (spawn/exec/execFile/kill), `websocket.js:35-130`
(start/handleMessage/handleClose). Findings below are grounded in that read.

### Decisions

**R1 — Skip exec entirely for non-`running` sprites. AGREED (promoted to PRIMARY lever).**
I concede this is the bigger win and I under-weighted it. Verified facts that make it correct
and free:
- `listAllSprites` (`client.js:95-112`) returns `status` per sprite from the control-plane LIST
  call — no exec, no wake. So passing the known status into `getRCStatus(name, status)` costs
  nothing.
- It also removes a *second* redundant control-plane round trip: current `getRCStatus` calls
  `getSprite(name)` (`client.js:47`, its own GET `/v1/sprites/<name>`) purely to read a status
  we already had. Skip-warm + status-param eliminates BOTH the exec AND that getSprite per warm
  sprite per tick.
- Semantics: a keepalive Task is what holds a sprite `running`; `status !== 'running'` (warm/cold)
  ⟹ no active task ⟹ RC inactive and not connectable. I could find no real case where a
  warm/cold sprite has a genuinely active, usable RC session. Agreed: `status !== 'running'` ⟹
  return `{active:false}` immediately, no exec, no getSprite.
- Note the current code (`remote-control.ts:92`) execs on BOTH `running` AND `warm` — that warm
  branch is exactly the 30s `engram` offender. R1 deletes it.
- This makes cadence/concurrency-cap SECONDARY safety nets (kept, but no longer the main lever).

**R2 — Drop the per-sprite mutex. AGREED.**
I concede. With R1 (only `running` sprites exec), a self-scheduling poll (no self-overlap), and a
per-exec timeout, a single running sprite issues ≤1 status exec per cycle and cycles cannot stack
— so there is no exec pileup left for a mutex to prevent. A mutex would only serialize a user's
Stop *behind* an in-flight status poll, adding latency to the most critical action. No mutex.
User actions fire immediately; only the poll loop is self-scheduled + concurrency-capped.
(The cap still matters for the N-running-sprites fan-out, not for self-overlap.)

**R3 — Throw + preserve-last-known instead of an explicit `{unknown}` contract. AGREED.**
I concede the `{active, unknown}` contract + neutral button state was over-engineered. Throw
`ExecTimeoutError` on timeout; return `{active:boolean}` only on a real answer. Client uses
`Promise.allSettled` and, for any rejected entry, MERGES — preserves prior `rcMap[name]` rather
than overwriting. Net: we never lie to `false`, the Stop button stays for an active session, no
new visible UI state. One caveat I want in the impl (not the contract): on the FIRST poll there
is no last-known value, so a timeout leaves the entry `undefined` → button renders as "RC"
(start). That is acceptable (no session is confirmed yet) and self-heals next cycle. Agreed.

**R4 — Optimistic-update vs skip-warm flicker. AGREED with a concrete mechanism.**
Real edge. Your sticky-grace idea is right; here is the minimal precise form:
- Keep a small `Map<name, expiresAt>` of "recently started" sprites (grace ~20s, ≥ observed
  warm→running lag). Set it on Start success alongside the optimistic `rcMap[name]=true`.
- In the client merge step: the status-GATE result (warm ⟹ inactive, computed WITHOUT an exec)
  may NOT downgrade a sprite whose grace window is unexpired. Only an exec-CONFIRMED contradiction
  (`status==='running'` AND `sprite-task get` returned empty) may set `false`, and that also
  clears the grace entry.
- This keeps the gate cheap (no exec) while preventing the Active→Idle→Active flicker. The grace
  is purely client-side; no server contract change.

**R5 — Start-guard timeout = surface an error, do not proceed/skip. AGREED.**
Verified the ambiguity is real: through the wrapper, the `tmux has-session -t claude` guard maps
a NON-ZERO exit to "no session, proceed" and ZERO to "already running, skip" — but a TIMEOUT
tells us neither. Verified at `exec.js:225-233`: a socket close without an Exit frame still emits
`exit` with code `-1`, which `execFile`/our wrapper treats as a non-zero ExecError, NOT a hang —
so the only true "unknown" is our own `ExecTimeoutError`. On guard timeout: return
`{ok:false, error:"Couldn't verify remote-control state, try again"}`. Proceeding risks a
duplicate `tmux new-session` collision; skipping strands the user. Agreed.

**R6 — Task breakdown. AGREED; keep Task C as ONE change.**
Splitting C (poll/data-flow vs UI-pending) would be artificial: the source-of-truth
consolidation (lift `sprites` to the parent, delete the table's redundant `listSprites` interval
at `sprite-table.tsx:46-51`, make the table presentational) inherently spans both files, and the
optimistic/grace logic (R4) couples the poll-merge to the button render. One coherent change with
the dependency on B's contract. A → B → C. Agreed as written.

### New risks / things we BOTH under-specified

- **N1 (verify before trusting): `cmd.kill()` on a never-opened socket.** Our timeout path calls
  `cmd.kill()` → `wsCmd.close()`. If the WS is still CONNECTING (the >30s pre-open stall — the
  exact case we hit), confirm `close()` on a CONNECTING undici socket actually aborts the
  handshake and doesn't throw. The wrapper must wrap `kill()` in try/catch and still settle the
  Promise regardless. Add a unit test for "timeout fires while socket never opened".
- **N2: double-settle hygiene in the wrapper.** `execFile` attaches `exit`/`error`/maxBuffer
  rejects; our wrapper adds a timer reject. Use a `settled` guard so a late `exit` after timeout
  can't double-resolve, and remove the timer in a `finally`. Cheap but easy to get wrong.
- **N3: server-side process lingers after `kill()`.** `kill()` closes our socket but the
  `sprite-task` process inside the sprite may complete anyway. Fine for idempotent reads
  (`get`) and re-runnable `delete`; call it out so nobody assumes kill cancels the remote work.
- **N4: stop idempotency string-matching.** "task already absent" must be treated as success.
  `sprite-task delete` of a missing task likely exits non-zero → ExecError, not timeout. Decide
  the success rule by exit code / stderr substring, and DON'T swallow a genuine timeout as
  success (timeout must still surface "couldn't confirm"). This was implicit in both plans;
  make it explicit in Task B.
- **N5: `requireAuth()` per call.** `getRCStatus` calls `requireAuth()` every invocation; under
  the fan-out that is N auth checks per tick. Confirm it's cheap (local cookie/session read, not
  a network call) — almost certainly fine, but worth a one-line check during impl.

### Status: AGREED

All of R1–R6 reconciled. R1 promoted to primary; mutex dropped; throw+preserve over `{unknown}`;
grace-window for optimistic stickiness; start-guard timeout surfaces an error; Task C stays
whole. Open items are impl-time verifications (N1–N5), not design disagreements.
