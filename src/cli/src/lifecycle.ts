/**
 * Signals that shut the server down gracefully.
 *
 * SIGHUP covers a closing terminal, a killed tmux session or window, and a dropped
 * SSH connection. Registering a JS handler also overrides an inherited SIG_IGN
 * disposition (nohup, supervisors, some terminal launchers) which would otherwise
 * swallow the hangup.
 */
const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

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
}
