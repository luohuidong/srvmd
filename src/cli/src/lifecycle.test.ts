import child_process from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import timers from "node:timers/promises";
import { afterAll, expect, test } from "vitest";

// `import.meta.dirname` keeps the path filesystem-native. A URL pathname would
// hand the child a percent-encoded specifier that cannot be resolved.
const lifecyclePath = path.join(import.meta.dirname, "lifecycle.ts");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "srvmd-lifecycle-"));

// Longer than one shutdown settling window, so a spurious exit has time to show up.
const SETTLE_MS = 1500;
const READY_TIMEOUT_MS = 8000;

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

type Fixture = {
  scriptPath: string;
  readyPath: string;
  closedPath: string;
};

/**
 * Child process that installs the lifecycle handlers with a recording close
 * callback and then keeps itself alive like a server would. Every shutdown
 * appends a line to `closedPath`, so that file doubles as a close-call count. The
 * child writes its pid to `readyPath` once the handlers are installed.
 */
function createFixture(name: string): Fixture {
  const dir = path.join(root, name);
  const readyPath = path.join(dir, "ready");
  const closedPath = path.join(dir, "closed");
  const scriptPath = path.join(dir, "child.mts");
  fs.mkdirSync(dir, { recursive: true });

  const script = [
    'import fs from "node:fs";',
    `import { installLifecycleHandlers } from ${JSON.stringify(lifecyclePath)};`,
    `installLifecycleHandlers(() => fs.appendFileSync(${JSON.stringify(closedPath)}, "closed\\n"));`,
    `fs.writeFileSync(${JSON.stringify(readyPath)}, String(process.pid));`,
    // Safety net so a failing test cannot leave a stray process behind. It exits
    // non-zero so a fired net fails the exit assertion instead of passing.
    "setTimeout(() => process.exit(3), 20000);",
    "setInterval(() => {}, 1000);",
  ].join("\n");
  fs.writeFileSync(scriptPath, script);

  return { scriptPath, readyPath, closedPath };
}

function closedCalls(fixture: Fixture): number {
  if (!fs.existsSync(fixture.closedPath)) return 0;
  return fs
    .readFileSync(fixture.closedPath, "utf8")
    .split("\n")
    .filter(line => line.length > 0).length;
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (fs.existsSync(path)) return;
    await timers.setTimeout(20);
  }
  throw new Error(`timed out waiting for ${path}`);
}

async function spawnChild(
  fixture: Fixture,
  cmd: string[],
): Promise<child_process.ChildProcess> {
  const [executable, ...args] = cmd;
  if (!executable) throw new Error("missing child executable");

  // Inherit stderr so a crashing child shows up in the test output instead of
  // filling an undrained pipe.
  const child = child_process.spawn(executable, args, {
    stdio: ["ignore", "ignore", "inherit"],
  });
  await waitForFile(fixture.readyPath);
  return child;
}

function signalChild(
  child: child_process.ChildProcess,
  signal: NodeJS.Signals,
): void {
  if (child.pid === undefined) throw new Error("child has no pid");
  process.kill(child.pid, signal);
}

function killChild(child: child_process.ChildProcess): void {
  if (child.exitCode !== null) return;
  try {
    child.kill("SIGKILL");
  } catch {
    // already gone
  }
}

function waitForExit(
  child: child_process.ChildProcess,
): Promise<number | null> {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  return new Promise((resolve, reject) => {
    child.once("exit", resolve);
    child.once("error", reject);
  });
}

async function expectGracefulExit(
  fixture: Fixture,
  child: child_process.ChildProcess,
): Promise<void> {
  try {
    expect(await waitForExit(child)).toBe(0);
    expect(closedCalls(fixture)).toBe(1);
  } finally {
    killChild(child);
  }
}

test.skipIf(process.platform === "win32")(
  "SIGHUP shuts the process down through the handler",
  async () => {
    const fixture = createFixture("sighup");
    const child = await spawnChild(fixture, [
      process.execPath,
      fixture.scriptPath,
    ]);
    signalChild(child, "SIGHUP");
    await expectGracefulExit(fixture, child);
  },
);

// A parent that ignores SIGHUP (nohup, supervisors, some terminal launchers) makes
// the disposition inherit as SIG_IGN across exec. Without a JS handler the hangup
// is swallowed and the server outlives the terminal.
test.skipIf(process.platform === "win32")(
  "SIGHUP still works when inherited as ignored",
  async () => {
    const fixture = createFixture("inherited-ignore");
    const child = await spawnChild(fixture, [
      "bash",
      "-c",
      'trap \'\' HUP; exec "$0" "$1"',
      process.execPath,
      fixture.scriptPath,
    ]);
    signalChild(child, "SIGHUP");
    await expectGracefulExit(fixture, child);
  },
);

test.skipIf(process.platform === "win32")(
  "shuts down exactly once when signals arrive twice",
  async () => {
    const fixture = createFixture("double-signal");
    const child = await spawnChild(fixture, [
      process.execPath,
      fixture.scriptPath,
    ]);
    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      try {
        signalChild(child, signal);
      } catch {
        // the first signal may already have exited the process
      }
    }
    await expectGracefulExit(fixture, child);
  },
);

test.skipIf(process.platform === "win32")(
  "keeps running until a signal arrives",
  async () => {
    const fixture = createFixture("stays-up");
    const child = await spawnChild(fixture, [
      process.execPath,
      fixture.scriptPath,
    ]);
    try {
      await timers.setTimeout(SETTLE_MS);
      expect(child.exitCode).toBeNull();
      expect(closedCalls(fixture)).toBe(0);
    } finally {
      killChild(child);
    }
  },
);
