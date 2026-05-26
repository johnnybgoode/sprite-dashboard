# RC exec saturation & UI freeze — agreed design

**Date:** 2026-05-26 · **Status:** agreed (two independent plans reconciled, round 2) · **Branch:** `feat/task-api-keepalive`

Canonical spec. Supersedes the two scratch plans (`*PLAN-claude.md`, `*PLAN-teammate.md`, kept for audit).

## Problem (reproduced in e2e smoke test, 2026-05-26)
`getRCStatus` runs a per-sprite `sprite.exec` every 5s for every warm/running sprite. The `@fly/sprites`
exec WebSocket has **no timeout** and a **dead reject guard**, so execs pile up and a user Stop wedges
forever. Observed: `getRCStatus` bimodal ~5.5s / ~30s (abort); `stopRemoteControl` wedged >90s, task never
deleted; the same delete via CLI = 0.204s. Plus a single shared `useTransition` freezes every button in the
table until reload.

## Root causes (grounded in SDK source)
1. **No deadline on the exec WS.** `exec.js`/`websocket.js` contain no `timeout|AbortSignal`; control-plane
   HTTP calls all use `AbortSignal.timeout(...)`. `execFile`'s promise settles only on an `Exit` stream frame
   (`websocket.js:105`) or socket close — a half-open/stalled socket settles **never**.
2. **Dead reject guard.** `websocket.js:39` sets `this.started = true` before the Promise; the `error`
   listener's `if (!this.started) reject(error)` (line 52) is therefore always false → `start()` never
   rejects on a WS error. (Errors still surface via the emitted `'error'` event, but a silent stall has no path.)
3. **One WS per exec, no pooling, no multiplexing.** Command is baked into the URL query (`exec.js:100`);
   the frame format has a single `StreamID` byte with no command id (`websocket.js:96`). One connection =
   one command. **⇒ "reuse the WebSocket" is NOT viable** (rejected — see below).
4. **Wasted execs on warm sprites.** A keepalive Task is what holds a sprite `running`; therefore
   `status !== 'running'` ⟹ no active task ⟹ RC inactive. Yet `getRCStatus` execs warm sprites too
   (`remote-control.ts:92`) — the 30s `engram` offender. It also calls `getSprite` (a second control-plane
   GET) just to read a status the parent already has.
5. **Self-overlapping poll.** Healthy exec (~5.5s) > poll interval (5s) ⇒ `setInterval` cycles stack.
6. **Global UI freeze.** One shared `useTransition`; every button `disabled={isPending}`.

## Rejected: WebSocket reuse / multiplexing
Protocol is one-command-per-connection (command in URL; no stream/command id in frames). `createSession`/
`attachSession` are TTY-mode → lose clean stdout/exit capture. And reuse fixes neither the missing timeout
nor the polling cadence. **Do not pursue.** Make exec *safe and infrequent* instead.

## Fixes (agreed R1–R6)

### Fix 1 — keystone: `execWithTimeout` (new `src/lib/sprite-exec.ts`)
Wrap an exec with a hard deadline so it can never wedge.
- Use `sprite.spawn(file, args, opts)` (non-TTY) to own the `SpriteCommand` handle; accumulate
  stdout/stderr/exit (mirror `execFile`'s buffering).
- Race against a timer. On timeout: call `cmd.kill()` (best-effort — see N1) and reject a typed
  **`ExecTimeoutError`** (distinct from a normal non-zero `ExecError`).
- `settled` guard so the timer-reject can't double-settle with exit/error; clear the timer in `finally` (N2).
- Attach `'exit'`/`'error'` listeners before/at start (mirror `execFile` ordering).
- Signature: `execWithTimeout(sprite, file, args, { timeoutMs }) => Promise<{stdout,stderr,exitCode}>`.
- Default timeouts **generous first** (status 10s, mutations 15s); constants, tune down later once
  de-saturated. (~5.5s healthy is itself a saturation symptom.)

### Fix 2 — `remote-control.ts`: safe + correct semantics
- Route **all** execs through `execWithTimeout` (status get, `sprite-task add`, `sprite-task delete`,
  the `tmux has-session` start-guard). The detached `createSession` RC session stays fire-and-forget (NOT bounded).
- **`getRCStatus(name, status)`** — accept the status the parent already has from `listSprites`.
  - `status !== 'running'` ⇒ return `{active:false}` immediately — **no exec, no getSprite** (Fix R1, primary load cut).
  - `status === 'running'` ⇒ one bounded `sprite-task get remote-control`; present ⇒ active.
  - On `ExecTimeoutError` ⇒ **throw** (do not lie to `{active:false}`); the client preserves last-known (R3).
- **`stopRemoteControl`** — bounded delete. **Idempotent:** a "task already absent" outcome (non-zero
  ExecError / known stderr, NOT a timeout) counts as success. A genuine `ExecTimeoutError` ⇒
  `{ok:false, error:"Could not confirm task deletion (timed out)"}` — the action *returns* (never wedges).
  Do NOT swallow a timeout as success (N4).
- **`startRemoteControl`** — start-guard `tmux has-session`: non-zero exit ⇒ "no session" (proceed);
  exit 0 ⇒ already running (skip). On `ExecTimeoutError` (the only true unknown — a close-without-exit
  yields exit `-1`, a normal ExecError, per `exec.js:225`) ⇒ return
  `{ok:false, error:"Couldn't verify RC state, try again"}` (R5). Don't silently proceed (dup tmux) or skip.

### Fix 3 — poll: `sprites-page-client.tsx`
- **Self-scheduling loop** (not `setInterval`): run `refreshRC`, schedule the next run only after it settles
  (+ floor delay). Cycles can't stack (R/Fix 5).
- **Skip-warm client-side:** only call `getRCStatus(name, status)` for `running` sprites; warm/cold ⇒ set
  `rcMap[name]=false` locally (no server call) (R1).
- **`Promise.allSettled` + merge/preserve:** never replace the whole map; keep prior `rcMap[name]` for any
  rejected/unknown sprite (R3). (First poll has no prior ⇒ `undefined` ⇒ renders idle; self-heals next cycle.)
- **Concurrency cap** (~2–3) on the running-sprite fan-out.
- RC status may poll **less often** than the cheap `listSprites` control-plane refresh.
- **Single source of truth:** lift `sprites` state to this parent; the table becomes presentational
  (remove the table's redundant `listSprites` interval, `sprite-table.tsx:46-51`).

### Fix 4 — UI per-row pending: `sprite-table.tsx`
- Replace the single `useTransition` disable source with **per-row+action pending** keyed by sprite name
  (`Record<string,"stop"|"rc-start"|"rc-stop">`). Set before await, clear in `finally`. Buttons disable on
  their own row only. (Actions always settle now → `finally` always clears → no "frozen until reload".)
- **Optimistic + grace (R4):** on Start success set `rcMap[name]=true` and a `graceUntil[name]=now+~20s`.
  In the poll merge, a non-exec status-gate result may NOT downgrade a sprite whose grace is unexpired;
  only an exec-confirmed contradiction (`running` + empty `sprite-task get`) sets false and clears grace.
  On Stop success, optimistically set `rcMap[name]=false`.

## Implementation-time risks to verify (N1–N5)
- **N1:** `WSCommand.close()` only acts when `readyState === OPEN`, so `kill()` on a still-CONNECTING socket
  is a no-op — the socket may leak until undici's own ~30s connect timeout. Acceptable under the new low exec
  volume; wrap `kill()` in try/catch and settle the wrapper promise regardless. Unit-test "never opens → times out".
- **N2:** double-settle guard + clear timer in `finally`.
- **N3:** `kill()` closes our socket but the remote `sprite-task` process may still complete — fine for
  idempotent get/delete; note it.
- **N4:** decide stop success by exit code/stderr, never treat a timeout as success.
- **N5:** `requireAuth()` is a local next-auth session read (no network) — N/tick is fine. (verified)

## Testing
- **Unit (vitest, new):** add `vitest` devDep + minimal `vitest.config.ts` (node env, `@`→`src` alias) +
  `"test":"vitest run"`. Test ONLY `sprite-exec.ts` with a fake `SpriteCommand` stub: (a) exit 0 resolves;
  (b) non-zero ⇒ ExecError; (c) never emits exit ⇒ `ExecTimeoutError` within `timeoutMs` AND `kill()` called;
  (d) `'error'` event ⇒ rejects; (e) settles exactly once.
- **Live e2e (acceptance — the critical path the user asked to re-test):** warm `engram` ⇒ **0 exec**
  (no 30s lines in dev log); start RC ⇒ Active; **Stop RC ⇒ task actually gone (`sprite-task get` CLI oracle,
  ~0.2s) and the action returns < timeout**; buttons never globally frozen (sprite B usable while A pending);
  no `aborted`/30s entries; status doesn't flap. **Never touch engram destructively (read-only).**

## Task breakdown (subagent-driven dev): A → B → C
- **A.** `sprite-exec.ts` + vitest setup + wrapper unit tests (foundational, isolated).
- **B.** `remote-control.ts` rewired through the wrapper (R1 skip-warm, R3 throw, R4-stop idempotent, R5 guard). Depends on A.
- **C.** `sprites-page-client.tsx` + `sprite-table.tsx` **together** (source-of-truth consolidation spans both):
  self-scheduling capped poll, skip-warm, allSettled+merge/preserve, per-row pending, optimistic+grace. Depends on B.

---

## Round 3 (post-first-retest) — status without per-poll exec

**Why:** live re-test proved skip-warm (0 exec for warm) and the un-wedge, BUT showed the SDK exec is
inherently slow/flaky in this runtime: CLI exec 0.2s; standalone undici-WS exec stable ~6.3s; under the
Next dev server (Node 20 has no native `WebSocket`; Next injects one) sequential `getRCStatus` is bimodal
~5.3s / >10s-timeout. `start`'s `sprite-task add` exec timed out at 15s **yet the task registered
server-side** — the command runs reliably; only the WS round-trip for stdout/exit is slow. So a per-poll
exec-confirm is the wrong tool: it can't reliably confirm, and it reintroduces cost on every running sprite.

**Revised design (agreed round 3):**
- **Drop per-poll exec-confirm.** `rcMap[name]` derives from: (a) optimistic on user action; (b) control-plane
  status downgrade (`status !== "running"` ⇒ false — a keepalive task holds it running); (c) **seed-once**:
  a `running` sprite whose `rcMap[name]` is `undefined` (unknown — e.g. fresh page load) gets ONE bounded
  `getRCStatus` exec to seed it. Known entries (`true`/`false`) on running sprites are NOT re-exec'd.
  Steady-state status execs ⇒ ~0.
- **Seed is non-authoritative & mutex-free:** a seed result is applied only if `rcMap[name]` is still
  `undefined` at merge time, so a concurrent user action (which sets it) wins. Seeds are rare, so no
  per-sprite mutex/priority-queue is needed (simplification vs. round-2 discussion; contention removed at
  the source by eliminating per-poll execs). On seed timeout, leave `undefined` ⇒ retried next cycle
  (~33s apart, self-limiting: stops on first success).
- **Generous timeouts:** status/seed + mutations 25s (was 10/15). Tolerates the ~6s floor + flakiness.
- **Start tolerant of task-add timeout:** `ExecTimeoutError` on `sprite-task add` ⇒ `{ok:true, unconfirmed:true}`
  (NOT hard-fail — the command runs server-side; consistent with `createSession` being fire-and-forget).
  A real `ExecError` still hard-fails. Caller sets optimistic `true` with **reduced grace (~5s)** on the
  unconfirmed path so a genuinely-failed task self-heals fast via status-downgrade.
- **Stop symmetric:** delete `ExecTimeoutError` ⇒ `{ok:true, unconfirmed:true}` (delete runs server-side;
  status reconciles); `ExecError` ⇒ `{ok:true}` (idempotent absent). Optimistic idle + clear grace.
- **`rcMapRef`** (effect-synced) so the `[]`-deps poll reads current rcMap to compute seed targets.
- **Accepted staleness (documented):** task-alive (or hook-refreshed) + RC-process-dead + still-running ⇒
  false `true` until user action or task-expiry+warm. Same blind spot as the old design (`sprite-task get`
  can't detect a dead process behind a live task); closing it needs `pgrep`/`tmux has-session` — out of scope.
- **Files:** `remote-control.ts` (timeouts↑, start/stop timeout-tolerant, `unconfirmed` flag),
  `sprites-page-client.tsx` (seed-once tri-state, `rcMapRef`, reduced-grace-on-unconfirmed). Wrapper unchanged.

---

## Round 4 (second retest) — the exec latency root cause: WebSocket implementation

Round-3 retest PROVED the design works (start/stop/seed/optimistic/per-row/skip-warm all correct, 0 per-poll
execs) but exec was slow here: start 30s, stop 25s, **seed timed out (>25s)**. Isolation showed why:
- CLI `sprite exec`: 0.2s. Raw SDK exec with **undici's `WebSocket`: stable ~6.3s**. Under the Next dev
  server (Node 20.19 has NO native `WebSocket`; Next injects one): flaky 5–30s, frequently >25s.
- ⇒ The bottleneck is the **`WebSocket` implementation the SDK's exec uses**, not the network/sprite.

**Fix:** `instrumentation.ts` `register()` pins `globalThis.WebSocket = (await import("undici")).WebSocket`
in the Node server runtime (added `undici@^6` — v8 needs Node 21+, breaks Node 20). The SDK reads the global
`WebSocket` at connect time, so this makes every exec use undici's reliable impl.

**Verified after the fix (Playwright + dev-log timings, undici):**
- seed exec **6.3s** (was >25s timeout) — discovers a pre-existing RC on reload, succeeds first try (self-limits).
- start **12.8s** (guard ~6s + task-add ~6s), stop **6.3s** (task confirmed deleted), **0 ExecTimeoutErrors**.
- still **0 per-poll status execs** (skip-warm + seed-once); engram never touched; no global UI freeze.

Note: undici override is safe everywhere (undici underpins Node's native WS); it also helps any deploy on
Node <22. The generous 25s timeouts + optimistic UI + status-downgrade remain the safety net if exec is ever
slow again.

---

## Round 5 — start guard must still (re)register the task

The round-1 `tmux has-session` guard returned `{ok:true}` early when the session existed, skipping
`sprite-task add`. But stop deletes the task and **leaves the tmux session**, so an immediate re-start
short-circuited and left RC with NO keepalive task ⇒ the sprite warmed and RC died. Fix: the guard only sets a
`sessionExists` flag; `createSession` is gated on `!sessionExists` (still no duplicate `tmux new-session`),
but `sprite-task add` (an idempotent upsert) now runs on **both** paths. Verified live: with a pre-existing
`claude` tmux session and no task, Start RC kept the session (no duplicate error) and registered the task
(`startRemoteControl` 11.9s, task created). `src/app/actions/remote-control.ts`.
