import { readlinkSync } from "node:fs";

/**
 * Signals that shut the server down gracefully.
 *
 * SIGHUP covers a closing terminal, a killed tmux session or window, and a dropped
 * SSH connection. Registering a JS handler also overrides an inherited SIG_IGN
 * disposition (nohup, supervisors, some terminal launchers) which would otherwise
 * swallow the hangup.
 */
const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

const WATCH_INTERVAL_MS = 1000;

/** Returns true once the condition it watches for has happened. */
type Probe = () => boolean;

export function installLifecycleHandlers(close: () => void): void {
  let stopping = false;

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    try {
      close();
    } finally {
      process.exit(0);
    }
  };

  for (const signal of SHUTDOWN_SIGNALS) process.on(signal, shutdown);

  // One timer for both probes: a single tick is enough to notice either condition.
  const probes = [parentProbe(), terminalProbe()].filter((probe): probe is Probe => probe !== null);
  watchUntil(probes, shutdown);
}

/**
 * A hangup only reaches a child when the shell forwards SIGHUP. When the parent
 * disappears quietly (a background job, a wrapper that exits right away) nothing
 * reaches the process at all, so poll the parent pid and stop once it changes.
 *
 * This covers a parent that dies after startup. A process that is already
 * reparented when the probe starts (an orphan, a `PID 1` container entrypoint)
 * looks exactly like a process started by a supervisor, so it is left running.
 */
export function watchParent(onGone: () => void): void {
  watchUntil([parentProbe()], onGone);
}

/**
 * Closing a terminal unlinks its devpts node, so a live process still holding the
 * hung-up tty reads `/dev/pts/N (deleted)`. Polling keeps the check passive:
 * reading stdin would stop a background job with SIGTTIN, and it cannot tell a
 * Ctrl+D from a hangup.
 *
 * Linux-only; other platforms have no `/proc`, and the parent watch still applies.
 */
export function watchTerminal(onGone: () => void): void {
  const probe = terminalProbe();
  if (probe) watchUntil([probe], onGone);
}

function parentProbe(): Probe {
  const parent = process.ppid;
  return () => process.ppid !== parent;
}

function terminalProbe(): Probe | null {
  if (process.platform !== "linux") return null;

  const fds = ([0, 1, 2] as const).filter(isStdioTty);
  if (fds.length === 0) return null;

  return () => fds.some(isDeletedTty);
}

/** Polls every probe on one unref'd timer and calls `onGone` once any of them fires. */
function watchUntil(probes: readonly Probe[], onGone: () => void): void {
  if (probes.length === 0) return;

  const timer = setInterval(() => {
    if (!probes.some(probe => probe())) return;
    clearInterval(timer);
    onGone();
  }, WATCH_INTERVAL_MS);
  timer.unref();
}

function isStdioTty(fd: 0 | 1 | 2): boolean {
  if (fd === 0) return process.stdin.isTTY === true;
  if (fd === 1) return process.stdout.isTTY === true;
  return process.stderr.isTTY === true;
}

function isDeletedTty(fd: number): boolean {
  try {
    return isDeletedTtyTarget(readlinkSync(`/proc/self/fd/${fd}`));
  } catch {
    return false;
  }
}

/**
 * Device paths that get unlinked when their terminal goes away. devpts nodes are
 * the common case; serial consoles and `/dev/console` disappear the same way.
 * Virtual consoles (`/dev/ttyN`) are absent on purpose: they are never unlinked.
 */
const HUNG_UP_TTY_TARGET = /^\/dev\/(?:pts\/\d+|ttyS\d+|ttyUSB\d+|ttyACM\d+|console)$/;

/** Matches the `readlink` of a hung-up tty fd, e.g. `/dev/pts/7 (deleted)`. */
export function isDeletedTtyTarget(target: string): boolean {
  const suffix = " (deleted)";
  if (!target.endsWith(suffix)) return false;

  return HUNG_UP_TTY_TARGET.test(target.slice(0, -suffix.length));
}
