import type fs from "node:fs";
import path from "node:path";

/** A filesystem path that has been validated to live inside the served root. */
export type ResolvedPath = {
  path: string;
  stats: fs.Stats;
  relative: string;
};

export function isInside(root: string, target: string): boolean {
  return (
    target === root ||
    target.startsWith(root.endsWith(path.sep) ? root : root + path.sep)
  );
}

export function isHiddenRelativePath(relativePath: string): boolean {
  return relativePath
    .split(/[\\/]/)
    .some(
      segment => segment.startsWith(".") && segment !== "." && segment !== "..",
    );
}

/** True when any segment of a root-relative path is in `names`. */
export function hasIgnoredSegment(
  relativePath: string,
  names: ReadonlySet<string>,
): boolean {
  return relativePath.split(/[\\/]/).some(segment => names.has(segment));
}
