import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { which } from "./which.js";

const actualPlatform = process.platform;
let tempDir: string;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true,
  });
}

function writeCommand(name: string, mode?: number): string {
  const file = path.join(tempDir, name);
  fs.writeFileSync(file, "");
  if (mode !== undefined) fs.chmodSync(file, mode);
  return file;
}

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "srvmd-which-"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  setPlatform(actualPlatform);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe.skipIf(process.platform === "win32")("which", () => {
  test("resolves an executable through PATH", () => {
    const executable = writeCommand("srvmd-command", 0o755);
    vi.stubEnv("PATH", tempDir);

    expect(which("srvmd-command")).toBe(executable);
  });

  test("returns null when the command is missing", () => {
    vi.stubEnv("PATH", tempDir);

    expect(which("srvmd-command")).toBeNull();
  });

  test("skips files that are not executable", () => {
    writeCommand("srvmd-command", 0o644);
    vi.stubEnv("PATH", tempDir);

    expect(which("srvmd-command")).toBeNull();
  });

  test("skips directories with a matching name", () => {
    fs.mkdirSync(path.join(tempDir, "srvmd-command"));
    vi.stubEnv("PATH", tempDir);

    expect(which("srvmd-command")).toBeNull();
  });

  test("searches PATH entries in order", () => {
    const first = path.join(tempDir, "first");
    const second = path.join(tempDir, "second");
    fs.mkdirSync(first);
    fs.mkdirSync(second);
    const executable = path.join(second, "srvmd-command");
    fs.writeFileSync(executable, "");
    fs.chmodSync(executable, 0o755);
    vi.stubEnv("PATH", [first, second].join(path.delimiter));

    expect(which("srvmd-command")).toBe(executable);
  });

  test("returns null when PATH is empty", () => {
    vi.stubEnv("PATH", "");

    expect(which("srvmd-command")).toBeNull();
  });
});

describe("which on Windows", () => {
  test("appends PATHEXT entries", () => {
    setPlatform("win32");
    vi.stubEnv("PATHEXT", ".EXE;.CMD");
    const executable = writeCommand("srvmd-command.CMD");
    vi.stubEnv("PATH", tempDir);

    expect(which("srvmd-command")).toBe(executable);
  });

  test("falls back to the default PATHEXT list", () => {
    setPlatform("win32");
    vi.stubEnv("PATHEXT", undefined);
    const executable = writeCommand("srvmd-command.EXE");
    vi.stubEnv("PATH", tempDir);

    expect(which("srvmd-command")).toBe(executable);
  });

  test("keeps an explicit extension", () => {
    setPlatform("win32");
    const executable = writeCommand("srvmd-command.CMD");
    vi.stubEnv("PATH", tempDir);

    expect(which("srvmd-command.CMD")).toBe(executable);
  });
});
