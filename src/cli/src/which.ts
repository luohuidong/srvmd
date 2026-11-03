/**
 * Minimal `which` implementation: locate an executable command by searching
 * the directories in PATH and, on Windows, expanding PATHEXT candidates.
 */
import fs from "node:fs";
import path from "node:path";

function isExecutable(candidate: string): boolean {
  try {
    if (!fs.statSync(candidate).isFile()) return false;
    if (process.platform === "win32") return true;
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Minimal `which`: resolve an executable through PATH and PATHEXT. */
export function which(command: string): string | null {
  const searchPath = process.env.PATH;
  if (!searchPath) return null;

  const names =
    process.platform === "win32" && path.extname(command) === ""
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
          .split(";")
          .filter(Boolean)
          .map(extension => command + extension)
      : [command];

  for (const directory of searchPath.split(path.delimiter)) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (isExecutable(candidate)) return candidate;
    }
  }
  return null;
}
