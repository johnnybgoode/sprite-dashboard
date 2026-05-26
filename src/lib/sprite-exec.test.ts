import { describe, it, expect, vi, afterEach } from "vitest";
import { EventEmitter } from "events";
import { PassThrough } from "stream";
import { ExecError } from "@fly/sprites";
import { execWithTimeout, ExecTimeoutError } from "./sprite-exec";

// ---------------------------------------------------------------------------
// Fake SpriteCommand
// ---------------------------------------------------------------------------
function makeFakeCmd() {
  const emitter = new EventEmitter();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const kill = vi.fn();

  return Object.assign(emitter, { stdout, stderr, kill });
}

type FakeCmd = ReturnType<typeof makeFakeCmd>;

function makeFakeSprite(cmd: FakeCmd) {
  return { spawn: vi.fn(() => cmd) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("execWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. exit 0 with stdout ⇒ resolves correctly
  it("resolves with stdout/stderr/exitCode on exit 0", async () => {
    const cmd = makeFakeCmd();
    const sprite = makeFakeSprite(cmd);

    const resultPromise = execWithTimeout(sprite, "/bin/echo", ["hello"]);

    // emit stdout data then exit
    cmd.stdout.push(Buffer.from("hello world\n"));
    cmd.stdout.push(null);
    cmd.stderr.push(null);
    cmd.emit("exit", 0);

    const result = await resultPromise;
    expect(result.stdout).toBe("hello world\n");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  // 2. non-zero exit ⇒ rejects with ExecError
  it("rejects with ExecError on non-zero exit", async () => {
    const cmd = makeFakeCmd();
    const sprite = makeFakeSprite(cmd);

    const resultPromise = execWithTimeout(sprite, "/bin/false", []);

    cmd.stdout.push(Buffer.from("out\n"));
    cmd.stdout.push(null);
    cmd.stderr.push(Buffer.from("err\n"));
    cmd.stderr.push(null);
    cmd.emit("exit", 1);

    await expect(resultPromise).rejects.toSatisfy((e: unknown) => {
      if (!(e instanceof ExecError)) return false;
      return e.exitCode === 1;
    });
  });

  // 3. timeout fires ⇒ rejects with ExecTimeoutError AND kill() called once
  it("rejects with ExecTimeoutError and calls kill() when deadline is exceeded", async () => {
    vi.useFakeTimers();
    const cmd = makeFakeCmd();
    const sprite = makeFakeSprite(cmd);

    const resultPromise = execWithTimeout(sprite, "/bin/sleep", ["999"], {
      timeoutMs: 5000,
    });

    // Attach rejection handler BEFORE advancing timers so the rejection is
    // handled synchronously when the timer fires — avoids unhandled rejection.
    const assertion = expect(resultPromise).rejects.toBeInstanceOf(ExecTimeoutError);

    // advance past the timeout
    await vi.advanceTimersByTimeAsync(5001);

    await assertion;
    expect(cmd.kill).toHaveBeenCalledTimes(1);
  });

  // 4. 'error' event ⇒ rejects with that error
  it("rejects with the error event's error object", async () => {
    const cmd = makeFakeCmd();
    const sprite = makeFakeSprite(cmd);

    const resultPromise = execWithTimeout(sprite, "/bin/cmd", []);
    const boom = new Error("socket disconnected");
    cmd.emit("error", boom);

    await expect(resultPromise).rejects.toBe(boom);
  });

  // 5. settles exactly once: emit exit then error — no double-settle
  it("settles exactly once when both exit and error fire", async () => {
    const cmd = makeFakeCmd();
    const sprite = makeFakeSprite(cmd);

    const resultPromise = execWithTimeout(sprite, "/bin/cmd", []);

    cmd.stdout.push(null);
    cmd.stderr.push(null);
    cmd.emit("exit", 0);
    // error after exit should be ignored (no unhandled rejection)
    cmd.emit("error", new Error("late error"));

    // resolves (not rejects) because exit 0 settled first
    const result = await resultPromise;
    expect(result.exitCode).toBe(0);
  });

  // 6. kill() throwing on timeout (e.g. socket still CONNECTING, N1) must not
  // prevent the promise from settling with ExecTimeoutError.
  it("still rejects with ExecTimeoutError when kill() throws on timeout", async () => {
    vi.useFakeTimers();
    const cmd = makeFakeCmd();
    cmd.kill.mockImplementation(() => {
      throw new Error("socket not open");
    });
    const sprite = makeFakeSprite(cmd);

    const resultPromise = execWithTimeout(sprite, "/bin/sleep", ["999"], {
      timeoutMs: 5000,
    });
    const assertion = expect(resultPromise).rejects.toBeInstanceOf(
      ExecTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(5001);
    await assertion;
    expect(cmd.kill).toHaveBeenCalledTimes(1);
  });
});
