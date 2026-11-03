import fsp from "node:fs/promises";
import path from "node:path";
import type { types } from "../../../shared/src/index.js";
import { IGNORED_NAMES } from "../constants.js";
import { isMarkdownFile } from "../file-kinds.js";
import { isInside } from "../fs-path.js";

export type DirectoryEntry = {
  name: string;
  kind: types.DirEntryKind;
  size?: number;
  mtime?: Date;
};

/** Read `dir` and return a sorted, filtered listing. `root` bounds symlink targets. */
export async function listDirectory(
  root: string,
  dir: string,
): Promise<DirectoryEntry[]> {
  const dirents = await fsp
    .readdir(dir, { withFileTypes: true })
    .catch(() => []);
  const entries: DirectoryEntry[] = [];

  await Promise.all(
    dirents.map(async dirent => {
      if (dirent.name.startsWith(".") || IGNORED_NAMES.has(dirent.name)) return;

      const full = path.join(dir, dirent.name);
      const stats = await fsp.stat(full).catch(() => null);
      if (!stats) return;

      if (dirent.isSymbolicLink()) {
        const real = await fsp.realpath(full).catch(() => null);
        if (!real || !isInside(root, real)) return;
      }

      entries.push({
        name: dirent.name,
        kind: stats.isDirectory()
          ? "dir"
          : isMarkdownFile(dirent.name)
            ? "markdown"
            : "file",
        size: stats.isDirectory() ? undefined : stats.size,
        mtime: stats.mtime,
      });
    }),
  );

  entries.sort((a, b) => {
    if ((a.kind === "dir") !== (b.kind === "dir"))
      return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  return entries;
}
