# Tasks-API Keepalive for Remote Control (no relay)

**Status:** plan · **Date:** 2026-05-25

## Context

Clicking "RC" starts `claude --remote-control` on a sprite so the user can connect from the Claude
mobile app, but sprites auto-sleep when idle and the session dies. The earlier fix kept the sprite
warm with a **browser ping** every 3 min (2h cap) — fragile because iOS suspends background timers
when the phone sleeps. A separate plan proposed an always-on **relay** to run the keepalive; those
docs are kept as a fallback (`2026-04-11-remote-control-design.md`,
`2026-05-25-relay-api-contract.md`).

sprites.dev now ships a native keepalive — the **Tasks API**. A registered task holds the sprite up
for up to **1 hour with no heartbeat**, which covers most sessions and removes the need for a relay.
This plan implements the Tasks API directly from the dashboard.

> **Scope — this is the webapp-side plan.** It assumes a companion change is in place that provisions
> in-sprite Claude Code hooks to *refresh* the task while Claude works (see the playbooks plan
> `playbooks/sprites/docs/superpowers/specs/2026-05-25-claude-keepalive-hooks-plan.md`). The webapp's
> only keepalive responsibilities are registering the **initial** task on start and **deleting** it on
> stop; it does **not** run a refresh loop.

### Key mechanism (verified live against sprite `engram`, 2026-05-25)

The original bug isn't just "exec returns" — it's that the RC session is a **TTY session**
(`createSession(..., { tty: true })`), and per the working-with-sprites doc *"any process started with
`sprite exec` or `sprite console` stops when the Sprite sleeps … TTY sessions don't [survive
hibernation]."* So the sprite hibernating to `warm` kills claude. **A registered task holds the sprite
in the `running` state, which is what keeps the TTY session alive.** Verified: with no task the sprite
sat in `warm` (hibernated) even while polled; registering a task flipped it to `running` within ~10s
and held it there; deleting the task released it.

The Tasks API is **not** a control-plane endpoint — it's served from a Unix socket **inside the
sprite** at `/.sprite/api.sock` (virtual host `sprite`). So the dashboard registers a task by running
curl **inside the sprite**, not by calling `api.sprites.dev`.

`PUT` is an **upsert** (verified: `PUT` on an absent task created it, HTTP 200), so we use a single
idempotent path — no separate create:
- **Start / refresh:** `PUT /v1/tasks/remote-control` body `{ "expire": "1h" }` → `200`, returns
  `{ name, started_at, expires_at }`. `expires_at` = `started_at` + exactly 1h, and each `PUT` resets
  the full hour (max `expire` is `1h`).
- **Release:** `DELETE /v1/tasks/remote-control` → `204`.
- **Read (status/debug):** `GET /v1/tasks` → `{ "tasks": [{ name, started_at, expires_at }] }`.
- **Invocation — explicit curl, through a shell.** Two verified constraints:
  1. `sprite.exec(str)` uses **no shell** — it splits on whitespace into argv
     (`node_modules/@fly/sprites/dist/exec.js:184-189`), shredding quoted JSON / the `Content-Type`
     header. Run via `sprite.execFile("bash", ["-c", cmd])` (the `terminal.ts:10` pattern).
  2. The `sprite-env curl` shorthand **rejects `-f`/`-fsS`** ("option -fsS: is badly used here"). Use
     the explicit form, which accepts `-fsS`:
     `curl -fsS --unix-socket /.sprite/api.sock -X PUT -H "Content-Type: application/json" -d '{"expire":"1h"}' http://sprite/v1/tasks/remote-control`.
  `-f` makes HTTP 4xx/5xx a non-zero exit (without it curl exits 0 on HTTP errors).

> All of the above was verified live; the only thing left for end-to-end is confirming a real
> `claude --remote-control` TTY session survives across an idle period with the task registered, and
> that the mobile app stays connected (deferred to implementation, see Verification).

### Error handling (load-bearing — `exec` rejects on non-zero exit)

`sprite.exec()` **rejects with `ExecError` on any non-zero exit** (`node_modules/@fly/sprites/dist/exec.js`),
and `-fsS` makes both transport failures and HTTP errors non-zero. So every task call can throw. The
keepalive must therefore be **best-effort and isolated** so it never silently corrupts RC state:
- `startRemoteControl`: create the session first, then `PUT` the task in its **own try/catch**. If the
  task call fails, the keepalive is the whole point — return `{ ok: false, error }` so the UI surfaces
  it (the session is left to expire naturally).
- `stopRemoteControl`: kill the session **first**, then `DELETE` the task **best-effort** (own
  try/catch, ignore failure — e.g. sprite already cold / task already expired). Killing first avoids a
  race where the session's in-sprite `Stop` hook re-registers the task after we delete it.

`curl` is preinstalled on the sprite image (verified).

### Keepalive refresh is owned by in-sprite hooks (not the webapp)

The webapp registers the task **once** on start so the sprite is held `running` immediately — this
bridges the gap between launching RC and the user actually connecting from the mobile app and sending
a first prompt (until then no in-sprite hook has fired yet).

From that point on, **refresh is the sprite's job**: provisioned Claude Code hooks (`UserPromptSubmit`,
`PreToolUse`, `Stop`) re-`PUT` the same `remote-control` task with `expire:"1h"` whenever Claude is
active, so the hold tracks real work and survives the phone sleeping or the dashboard tab closing —
no fixed-interval browser refresh, no `visibilitychange` logic. See the companion playbooks plan for
the hook details and the one known gap (a single tool call running longer than 1h). The webapp
deliberately does **not** refresh.

## Implementation

All paths under `sprite-dashboard/`. Per `AGENTS.md`, this is a modified Next.js — read the relevant
guide in `node_modules/next/dist/docs/` before editing server-action / App Router code.

### 1. `src/app/actions/remote-control.ts` (rewrite)

Add a private helper that runs a task call via **`sprite.execFile("bash", ["-c", cmd])`** (NOT
`sprite.exec` — see Invocation above) against the socket, e.g. `taskCall(sprite, method)`. Keep the
curl command a hardcoded literal (constant `name`/`expire`; no interpolation). See the Error handling
section above for the required try/catch placement. Then:

- **`startRemoteControl(name)`** — keep the existing "already running?" `listSessions` guard and the
  detached `createSession("bash", ["-l","-c","claude --dangerously-skip-permissions --remote-control"], { tty: true })`;
  then **`PUT`** the task (`{expire:"1h"}`) in its own try/catch so the sprite is held `running` the
  moment we return. On task failure return `{ ok: false, error }` (keepalive is the point).
- **`stopRemoteControl(name)`** — kill the session **first**, then **`DELETE`** the task best-effort
  (own try/catch, ignore failure). **Fix the existing kill while here:** the current
  `sprite.exec("tmux kill-session -t claude 2>/dev/null || true")` is broken (exec splits on
  whitespace, so the redirect/`|| true` are passed as literal argv to `tmux`, not interpreted) — route
  it through `execFile("bash", ["-c", "tmux kill-session -t claude 2>/dev/null || true"])`. Return
  `{ ok }`. (No `refreshRemoteControlTask` — refresh is owned by in-sprite hooks; see above.)
- **`getRCStatus(name)`** — unchanged (`listSessions`). Verified: this control-plane poll only briefly
  re-warms the sprite — it does **not** hold it `running`, so it does not keep the TTY session alive.
  The task is the sole keepalive.
- **Remove `pingSprite`** — superseded by the task.

### 2. `src/components/sprites/sprite-table.tsx`

- Keep the three-state RC button (Idle → Starting → Active) calling `startRemoteControl` /
  `stopRemoteControl`.
- **Remove the entire browser keepalive machinery** (currently lines 9, 46-100):
  - the `pingSprite` import (line 9);
  - the `pingIntervals` / `pingTimeouts` refs (46-47);
  - the `RC_PING_INTERVAL` / `RC_MAX_DURATION` constants (49-50);
  - the `startPinging` / `stopPinging` `useCallback`s (52-80);
  - the rcMap-sync `useEffect` (83-92) and the unmount-cleanup `useEffect` (94-100);
  - then drop any now-unused imports (`useCallback`, `useRef` look likely — confirm against the rest
    of the file).
- **Deliberate behaviour change:** the removed auto-stop `setTimeout` (line 62-65) means RC no longer
  force-stops at 2h — the task now governs lifetime (held while the tab refreshes; lapses ≤1h after
  the tab is gone). This is intended, not an oversight.

### 3. `src/components/sprites/sprites-page-client.tsx`

**No change.** Keep the existing `refreshRC` status poll (drives `rcMap`). Because hooks own the
refresh, the webapp adds **no** task-refresh interval, `rcMapRef`, or `visibilitychange` logic here.

### 4. Sprite-side hooks — companion plan

The keepalive *refresh* (and its provisioning) lives in the playbooks plan
`playbooks/sprites/docs/superpowers/specs/2026-05-25-claude-keepalive-hooks-plan.md` (extends the
`claude` role). This webapp plan only assumes those hooks exist; it touches no playbook files.

## Verification

**Already verified live against sprite `engram` (2026-05-25):** `PUT` upserts (create-or-refresh,
`200`, `expires_at` = `started_at`+1h, full reset each call); `DELETE` → `204`; `GET /v1/tasks` →
`{ tasks: [{ name, started_at, expires_at }] }`; a registered task flips the sprite to `running` and
holds it; with no task, control-plane polling only re-warms (sprite stays hibernated, TTY would die).
The explicit `curl -fsS --unix-socket …` form works; `sprite-env curl` rejects `-f`.

Remaining checks during implementation:

1. **End-to-end TTY survival (the real test):** start a real `claude --remote-control` session, leave
   it idle a few minutes with the task registered, and confirm the **mobile app stays connected** and
   the tmux/claude process is still alive (this is what the docs say TTY sessions normally lose on
   hibernation — the task should prevent it).
2. **Stop:** click Stop RC; confirm `GET /v1/tasks` is empty and the tmux session is gone. Also stop on
   an already-cold sprite and confirm it doesn't error (best-effort `DELETE`).
3. **Start failure surfaces:** simulate a failing task call (e.g. bad body) and confirm
   `startRemoteControl` returns `{ ok: false, error }` and the UI shows it rather than a silent
   "started".
4. **No pings / no refresh loop:** confirm the webapp no longer issues the old `pingSprite` no-op loop
   and adds no task-refresh interval (refresh comes from the sprite-side hooks).
5. **Static:** `npm run build` and `tsc` pass.

> Ongoing-refresh behaviour (long sessions, phone asleep, the >1h single-tool gap) is verified in the
> companion playbooks plan, since that's where the hooks live.
