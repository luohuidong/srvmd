import type fs from "node:fs";

type Validators = {
  etag: string;
  lastModified: string;
};

/** Build the strong ETag / Last-Modified pair for file responses. */
export function computeValidators(stats: fs.Stats): Validators {
  return {
    etag: `"${stats.size.toString(16)}-${stats.mtime.getTime().toString(16)}"`,
    lastModified: stats.mtime.toUTCString(),
  };
}

export function applyValidators(
  headers: Headers,
  validators: Validators,
): void {
  headers.set("ETag", validators.etag);
  headers.set("Last-Modified", validators.lastModified);
  headers.set("Accept-Ranges", "bytes");
}

/** Compare an If-None-Match header with an ETag (or `*`) using weak comparison. */
export function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) return false;

  const opaque = (value: string) =>
    value.startsWith("W/") ? value.slice(2) : value;
  const expected = opaque(etag);

  return header.split(",").some(value => {
    const candidate = value.trim();
    return candidate === "*" || opaque(candidate) === expected;
  });
}

/**
 * Evaluate If-None-Match first, then If-Modified-Since (the same precedence
 * RFC 9110 requires). Returns true when the client already has this version.
 */
export function isNotModified(
  request: Request,
  validators: Validators,
  stats: fs.Stats,
): boolean {
  const noneMatch = request.headers.get("if-none-match");
  if (noneMatch) return matchesEtag(noneMatch, validators.etag);

  const modifiedSince = request.headers.get("if-modified-since");
  if (!modifiedSince) return false;
  const since = Date.parse(modifiedSince);
  if (!Number.isFinite(since)) return false;
  return Math.floor(stats.mtime.getTime() / 1000) <= Math.floor(since / 1000);
}
