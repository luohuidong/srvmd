import type { Stats } from "node:fs";

export type Validators = {
  etag: string;
  lastModified: string;
};

/** Build the weak ETag / Last-Modified pair Bun's routes would otherwise add. */
export function computeValidators(stats: Stats): Validators {
  return {
    etag: `W/"${stats.size.toString(16)}-${stats.mtime.getTime().toString(16)}"`,
    lastModified: stats.mtime.toUTCString(),
  };
}

export function applyValidators(headers: Headers, validators: Validators): void {
  headers.set("ETag", validators.etag);
  headers.set("Last-Modified", validators.lastModified);
  headers.set("Accept-Ranges", "bytes");
}

/**
 * Evaluate If-None-Match first, then If-Modified-Since (the same precedence
 * RFC 9110 requires). Returns true when the client already has this version.
 */
export function isNotModified(request: Request, validators: Validators, stats: Stats): boolean {
  const noneMatch = request.headers.get("if-none-match");
  if (noneMatch) {
    return noneMatch.split(",").some(value => value.trim() === validators.etag);
  }

  const modifiedSince = request.headers.get("if-modified-since");
  if (!modifiedSince) return false;
  const since = Date.parse(modifiedSince);
  if (!Number.isFinite(since)) return false;
  return Math.floor(stats.mtime.getTime() / 1000) <= Math.floor(since / 1000);
}
