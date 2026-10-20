import { readdir, realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import { IGNORED_NAMES } from "../constants.ts";
import { isMarkdownFile } from "../file-kinds.ts";
import { isInside } from "../path.ts";
import type { DirectoryEntry } from "../types.ts";

/** Read a directory and return a sorted, filtered listing. */
export async function listDirectory(dir: string, root: string): Promise<DirectoryEntry[]> {
  const dirents = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const entries: DirectoryEntry[] = [];

  await Promise.all(
    dirents.map(async dirent => {
      if (dirent.name.startsWith(".") || IGNORED_NAMES.has(dirent.name)) return;

      const full = join(dir, dirent.name);
      const stats = await stat(full).catch(() => null);
      if (!stats) return;

      if (dirent.isSymbolicLink()) {
        const real = await realpath(full).catch(() => null);
        if (!real || !isInside(root, real)) return;
      }

      entries.push({
        name: dirent.name,
        kind: stats.isDirectory() ? "dir" : isMarkdownFile(dirent.name) ? "markdown" : "file",
        size: stats.isDirectory() ? undefined : stats.size,
        mtime: stats.mtime,
      });
    }),
  );

  entries.sort((a, b) => {
    if ((a.kind === "dir") !== (b.kind === "dir")) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });

  return entries;
}
