export async function openInBrowser(url: string): Promise<void> {
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];

  try {
    Bun.spawn({ cmd: command, stdout: "ignore", stderr: "ignore" }).unref();
  } catch {
    // Opening the browser is best-effort.
  }
}
