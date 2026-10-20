export function installSignalHandlers(close: () => void): void {
  let stopping = false;

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
