import type { Sprite } from "@fly/sprites";
import { ExecError } from "@fly/sprites";

/**
 * Thrown when execWithTimeout's deadline fires before the command finishes.
 */
export class ExecTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecTimeoutError";
  }
}

/** Minimal structural type for the SpriteCommand handle returned by spawn(). */
interface ReadableStream {
  on(event: "data", listener: (chunk: Buffer) => void): this;
}

interface SpriteCommandLike {
  stdout: ReadableStream;
  stderr: ReadableStream;
  on(event: "exit", listener: (code: number) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  kill(): void;
}

/**
 * Execute a file on a sprite with a hard timeout.
 *
 * Mirrors the SDK's own execFile buffering behaviour but guarantees the
 * returned promise settles within `timeoutMs` milliseconds.
 */
export async function execWithTimeout(
  sprite: Sprite | { spawn: (...args: unknown[]) => SpriteCommandLike },
  file: string,
  args: string[] = [],
  opts: { timeoutMs?: number } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const timeoutMs = opts.timeoutMs ?? 10_000;

  const cmd = (sprite as { spawn: (...args: unknown[]) => SpriteCommandLike }).spawn(file, args, {});

  return new Promise((resolve, reject) => {
    let settled = false;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    function settle(fn: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        cmd.kill();
      } catch {
        // best-effort: socket may not be open yet
      }
      reject(
        new ExecTimeoutError(
          `Command timed out after ${timeoutMs} ms: ${file}`,
        ),
      );
    }, timeoutMs);

    cmd.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    cmd.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    cmd.on("exit", (code: number) => {
      settle(() => {
        const stdout = Buffer.concat(stdoutChunks).toString("utf8");
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        if (code !== 0) {
          reject(
            new ExecError(`Command failed with exit code ${code}`, {
              stdout,
              stderr,
              exitCode: code,
            }),
          );
        } else {
          resolve({ stdout, stderr, exitCode: code });
        }
      });
    });

    cmd.on("error", (err: Error) => {
      settle(() => reject(err));
    });
  });
}
