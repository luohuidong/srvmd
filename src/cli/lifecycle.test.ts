import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Subprocess } from "bun";
import { isDeletedTtyTarget } from "./lifecycle.ts";

// `import.meta.dir` keeps the path filesystem-native. A URL pathname would hand the
// child a percent-encoded specifier that cannot be resolved (`/tmp/a%20b/x.ts`).
const lifecyclePath = join(import.meta.dir, "lifecycle.ts");
const root = mkdtempSync(join(tmpdir(), "srvmd-lifecycle-"));

// Longer than one lifecycle poll, so a spurious shutdown has time to fire.
const SETTLE_MS = 1500;
const READY_TIMEOUT_MS = 8000;

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

type Helper = "installLifecycleHandlers" | "watchParent" | "watchTerminal";

type Fixture = {
  scriptPath: string;
  readyPath: string;
  closedPath: string;
};

/**
 * Child process that runs `helper` with a recording close callback and then keeps
 * itself alive like a server would. Every shutdown appends a line to `closedPath`,
 * so that file doubles as a close-call count. The child writes its pid to
 * `readyPath` once the helper is installed.
 */
function createFixture(name: string, helper: Helper): Fixture {
  const dir = join(root, name);
  const readyPath = join(dir, "ready");
  const closedPath = join(dir, "closed");
  const scriptPath = join(dir, "child.ts");
  mkdirSync(dir, { recursive: true });

  const script = [
    'import { appendFileSync, writeFileSync } from "node:fs";',
    `import { ${helper} } from ${JSON.stringify(lifecyclePath)};`,
    `${helper}(() => appendFileSync(${JSON.stringify(closedPath)}, "closed\\n"));`,
    `writeFileSync(${JSON.stringify(readyPath)}, String(process.pid));`,
    // Safety net so a failing test cannot leave a stray process behind. It exits
    // non-zero so a fired net fails the `exited` assertion instead of passing.
    "setTimeout(() => process.exit(3), 20000);",
    "setInterval(() => {}, 1000);",
  ].join("\n");
  writeFileSync(scriptPath, script);

  return { scriptPath, readyPath, closedPath };
}

function closedCalls(fixture: Fixture): number {
  if (!existsSync(fixture.closedPath)) return 0;
  return readFileSync(fixture.closedPath, "utf8")
    .split("\n")
    .filter(line => line.length > 0).length;
}

async function waitFor(predicate: () => boolean, description: string, timeoutMs = READY_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await Bun.sleep(20);
  }
  throw new Error(`timed out waiting for ${description}`);
}

function waitForFile(path: string): Promise<void> {
  return waitFor(() => existsSync(path), path);
}

async function spawnChild(fixture: Fixture, cmd: string[]): Promise<Subprocess> {
  // Inherit stderr so a crashing child shows up in the test output instead of
  // filling an undrained pipe.
  const child = Bun.spawn({ cmd, stdout: "ignore", stderr: "inherit" });
  await waitForFile(fixture.readyPath);
  return child;
}

function killChild(child: Subprocess): void {
  try {
    child.kill("SIGKILL");
  } catch {
    // already gone
  }
}

function killQuietly(pid: number): void {
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // already gone
  }
}

function childPid(fixture: Fixture): number {
  return Number(readFileSync(fixture.readyPath, "utf8"));
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killFixture(fixture: Fixture): void {
  if (!existsSync(fixture.readyPath)) return;
  killQuietly(childPid(fixture));
}

async function expectGracefulExit(fixture: Fixture, child: Subprocess): Promise<void> {
  try {
    expect(await child.exited).toBe(0);
    expect(closedCalls(fixture)).toBe(1);
  } finally {
    killChild(child);
  }
}

test.skipIf(process.platform === "win32")("SIGHUP shuts the process down through the handler", async () => {
  const fixture = createFixture("sighup", "installLifecycleHandlers");
  const child = await spawnChild(fixture, [process.execPath, fixture.scriptPath]);
  process.kill(child.pid, "SIGHUP");
  await expectGracefulExit(fixture, child);
});

// A parent that ignores SIGHUP (nohup, supervisors, some terminal launchers) makes
// the disposition inherit as SIG_IGN across exec. Without a JS handler the hangup
// is swallowed and the server outlives the terminal.
test.skipIf(process.platform === "win32")("SIGHUP still works when inherited as ignored", async () => {
  const fixture = createFixture("inherited-ignore", "installLifecycleHandlers");
  const child = await spawnChild(fixture, [
    "bash",
    "-c",
    'trap \'\' HUP; exec "$0" "$1"',
    process.execPath,
    fixture.scriptPath,
  ]);
  process.kill(child.pid, "SIGHUP");
  await expectGracefulExit(fixture, child);
});

test.skipIf(process.platform === "win32")("shuts down exactly once when signals arrive twice", async () => {
  const fixture = createFixture("double-signal", "installLifecycleHandlers");
  const child = await spawnChild(fixture, [process.execPath, fixture.scriptPath]);
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    try {
      process.kill(child.pid, signal);
    } catch {
      // the first signal may already have exited the process
    }
  }
  await expectGracefulExit(fixture, child);
});

test.skipIf(process.platform === "win32")("stays up while its parent is alive", async () => {
  const fixture = createFixture("stays-up", "installLifecycleHandlers");
  const child = await spawnChild(fixture, [process.execPath, fixture.scriptPath]);
  try {
    await Bun.sleep(SETTLE_MS);
    expect(child.exitCode).toBeNull();
    expect(closedCalls(fixture)).toBe(0);
  } finally {
    killChild(child);
  }
});

// Background jobs and `setsid` leave the server without a parent and without any
// signal, so the parent watch has to notice the reparenting.
test.skipIf(process.platform === "win32")(
  "exits when the parent shell disappears",
  async () => {
    const fixture = createFixture("orphan", "watchParent");
    try {
      await spawnChild(fixture, [
        "bash",
        "-c",
        'exec "$0" "$1" >/dev/null 2>&1 & sleep 2',
        process.execPath,
        fixture.scriptPath,
      ]);
      await waitForFile(fixture.closedPath);
      expect(closedCalls(fixture)).toBe(1);
    } finally {
      killFixture(fixture);
    }
  },
  15000,
);

// This is the flip side of the parent watch, and it is a deliberate limitation:
// a process that was already reparented before the probe started is
// indistinguishable from one started by a supervisor, so it keeps running.
// Treating a reaper parent as a hangup would stop every `docker run` and
// systemd-managed server on startup.
test.skipIf(process.platform === "win32")(
  "keeps running when it is already orphaned before startup",
  async () => {
    const fixture = createFixture("orphaned-at-start", "watchParent");
    try {
      // `& exit` drops the shell immediately, so the probe records the reaper pid
      // instead of the launcher, exactly like `setsid srvmd` or a container entrypoint.
      const launcher = await spawnChild(fixture, [
        "bash",
        "-c",
        'exec "$0" "$1" >/dev/null 2>&1 & exit 0',
        process.execPath,
        fixture.scriptPath,
      ]);

      // The launcher is gone while the fixture keeps running: the exact situation
      // the parent watch must not treat as a hangup.
      expect(await launcher.exited).toBe(0);
      await Bun.sleep(SETTLE_MS);
      expect(isRunning(childPid(fixture))).toBe(true);
      expect(closedCalls(fixture)).toBe(0);
    } finally {
      killFixture(fixture);
    }
  },
  15000,
);

/**
 * `script` needs util-linux' `-q -c <command> <file>`; BusyBox ships a different
 * `script`, so probe the flags instead of trusting `which`.
 */
function detectPtyHost(): string | null {
  if (process.platform !== "linux") return null;

  const script = Bun.which("script");
  if (script === null) return null;

  try {
    const probe = Bun.spawnSync({
      cmd: [script, "-q", "-c", "exit 0", "/dev/null"],
      stdout: "ignore",
      stderr: "ignore",
    });
    return probe.exitCode === 0 ? script : null;
  } catch {
    return null;
  }
}

const ptyHostCommand = detectPtyHost();

// Closing the terminal unlinks the devpts node. With SIGHUP ignored by the
// launching shell nothing reaches the process, so only the tty watch can stop it.
test.skipIf(ptyHostCommand === null)(
  "stops when the terminal hangs up while SIGHUP is ignored",
  async () => {
    const fixture = createFixture("tty", "watchTerminal");
    const inner = `trap '' HUP; exec "${process.execPath}" "${fixture.scriptPath}"`;
    const ptyHost = Bun.spawn({
      // The fallback is unreachable: without a capable `script` the test is skipped.
      cmd: [ptyHostCommand ?? "script", "-q", "-c", inner, "/dev/null"],
      stdout: "ignore",
      stderr: "ignore",
    });

    try {
      await waitForFile(fixture.readyPath);
      ptyHost.kill("SIGKILL"); // closes the pty master, hanging up the terminal
      await waitForFile(fixture.closedPath);
      expect(closedCalls(fixture)).toBe(1);
    } finally {
      killChild(ptyHost);
      killFixture(fixture);
    }
  },
  15000,
);

test("recognizes hung-up tty targets", () => {
  expect(isDeletedTtyTarget("/dev/pts/7 (deleted)")).toBe(true);
  expect(isDeletedTtyTarget("/dev/ttyS0 (deleted)")).toBe(true);
  expect(isDeletedTtyTarget("/dev/ttyUSB0 (deleted)")).toBe(true);
  expect(isDeletedTtyTarget("/dev/console (deleted)")).toBe(true);
  expect(isDeletedTtyTarget("/dev/pts/7")).toBe(false);
  expect(isDeletedTtyTarget("/dev/tty1 (deleted)")).toBe(false);
  expect(isDeletedTtyTarget("/tmp/server.log (deleted)")).toBe(false);
  expect(isDeletedTtyTarget("/dev/null")).toBe(false);
});
