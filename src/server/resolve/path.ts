import { realpath, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { isHiddenRelativePath, isInside } from "../path.ts";
import type { ResolvedPath } from "../types.ts";

export type ResolveResult =
  | { ok: true; resolved: ResolvedPath }
  | { ok: false; status: 400 | 403 | 404; reason: string };

/** Validate and resolve a request path inside the served root (symlink-safe). */
export async function resolveRequest(root: string, pathname: string): Promise<ResolveResult> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { ok: false, status: 400, reason: "Malformed URL" };
  }

  if (decoded.includes("\0")) {
    return { ok: false, status: 400, reason: "Malformed URL" };
  }

  const candidate = resolve(root, `.${decoded}`);
  if (!isInside(root, candidate)) {
    return { ok: false, status: 403, reason: "Path escapes the served directory" };
  }

  const real = await realpath(candidate).catch(() => null);
  if (!real) return { ok: false, status: 404, reason: "Not found" };
  if (!isInside(root, real)) {
    return { ok: false, status: 403, reason: "Path escapes the served directory" };
  }

  const stats = await stat(real).catch(() => null);
  if (!stats) return { ok: false, status: 404, reason: "Not found" };

  const rel = relative(root, real).split(sep).join("/");
  if (rel && isHiddenRelativePath(rel)) {
    return { ok: false, status: 404, reason: "Hidden paths are not served" };
  }

  return { ok: true, resolved: { path: real, stats, relative: rel } };
}
