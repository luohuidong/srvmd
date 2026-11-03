import fsp from "node:fs/promises";
import path from "node:path";

export type ShellCache = {
  read(): Promise<string | null>;
};

/**
 * Cache the built shell by mtime. It is a build artifact, so re-reading it on
 * every navigation is wasted I/O; replacing it while the server runs (for
 * example with a rebuild) is still picked up because the mtime is checked on
 * each read.
 */
export function createShellCache(webRoot: string): ShellCache {
  const filePath = path.join(webRoot, "index.html");
  let cached: { mtimeMs: number; template: string } | null = null;

  return {
    async read() {
      const stats = await fsp.stat(filePath).catch(() => null);
      if (!stats?.isFile()) {
        cached = null;
        return null;
      }
      if (cached && cached.mtimeMs === stats.mtimeMs) return cached.template;

      const template = await fsp.readFile(filePath, "utf8");
      cached = { mtimeMs: stats.mtimeMs, template };
      return template;
    },
  };
}
