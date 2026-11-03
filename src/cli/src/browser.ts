import child_process from "node:child_process";
import { which } from "./which.js";

/**
 * Resolve the command that opens `url` in the default browser.
 *
 * The branch order is the contract here; reordering it silently breaks users.
 * WSL is not a `process.platform` value: it reports "linux", so it has to be
 * detected through environment variables before the Linux fallback is tried.
 */
export function resolveBrowserCommand(url: string): string[] | null {
  if (process.platform === "darwin") return ["open", url];
  // `start` reads its first quoted argument as the window title, so the empty
  // string is what keeps `url` in the command argument slot.
  if (process.platform === "win32") return ["cmd", "/c", "start", "", url];

  // In WSL `xdg-open` opens a viewer inside the distro that the user usually
  // cannot see, so the Windows interop launchers win: `wslview` (from wslu)
  // opens the Windows default browser, and the interop binaries cover installs
  // without wslu, in the order of how reliably they are present.
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) {
    if (which("wslview")) return ["wslview", url];
    if (which("cmd.exe")) return ["cmd.exe", "/c", "start", "", url];
    if (which("explorer.exe")) return ["explorer.exe", url];
  }

  // Plain Linux, and the last resort for WSL that exposes no interop binaries.
  if (which("xdg-open")) return ["xdg-open", url];
  // No launcher available. Callers treat opening as best-effort and stay quiet.
  return null;
}

export async function openInBrowser(url: string): Promise<void> {
  const command = resolveBrowserCommand(url);
  if (!command) return;

  const [executable, ...args] = command;
  if (!executable) return;

  try {
    child_process
      .spawn(executable, args, { stdio: "ignore", detached: true })
      .on("error", () => {})
      .unref();
  } catch {
    // Opening the browser is best-effort.
  }
}
