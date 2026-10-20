import { sep } from "node:path";

export function isInside(root: string, target: string): boolean {
  return target === root || target.startsWith(root.endsWith(sep) ? root : root + sep);
}

export function isHiddenRelativePath(relativePath: string): boolean {
  return relativePath.split(/[\\/]/).some(segment => segment.startsWith(".") && segment !== "." && segment !== "..");
}
