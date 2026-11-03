import fsp from "node:fs/promises";
import path from "node:path";
import { IGNORED_NAMES } from "../constants.js";
import {
  hasIgnoredSegment,
  isHiddenRelativePath,
  isInside,
  type ResolvedPath,
} from "../fs-path.js";

type ResolveResult =
  | { ok: true; resolved: ResolvedPath }
  | { ok: false; status: 400 | 403 | 404; reason: string };

/** Validate and resolve a request path inside the served root (symlink-safe). */
export async function resolveRequest(
  root: string,
  pathname: string,
): Promise<ResolveResult> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { ok: false, status: 400, reason: "Malformed URL" };
  }

  if (decoded.includes("\0")) {
    return { ok: false, status: 400, reason: "Malformed URL" };
  }

  const candidate = path.resolve(root, `.${decoded}`);
  if (!isInside(root, candidate)) {
    return {
      ok: false,
      status: 403,
      reason: "Path escapes the served directory",
    };
  }

  const real = await fsp.realpath(candidate).catch(() => null);
  if (!real) return { ok: false, status: 404, reason: "Not found" };
  if (!isInside(root, real)) {
    return {
      ok: false,
      status: 403,
      reason: "Path escapes the served directory",
    };
  }

  const stats = await fsp.stat(real).catch(() => null);
  if (!stats) return { ok: false, status: 404, reason: "Not found" };

  const rel = path.relative(root, real).split(path.sep).join("/");
  if (rel && isHiddenRelativePath(rel)) {
    return { ok: false, status: 404, reason: "Hidden paths are not served" };
  }

  // Match against the resolved path so a symlink cannot smuggle in a directory
  // that the watcher and directory listings already exclude.
  if (rel && hasIgnoredSegment(rel, IGNORED_NAMES)) {
    return { ok: false, status: 404, reason: "Ignored paths are not served" };
  }

  return { ok: true, resolved: { path: real, stats, relative: rel } };
}
