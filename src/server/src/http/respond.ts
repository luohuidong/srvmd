import fs from "node:fs";
import stream from "node:stream";
import mime from "mime";
import type { contracts } from "../../../shared/src/index.js";
import {
  applyValidators,
  computeValidators,
  isNotModified,
} from "./validators.js";

/** Headers every response gets, regardless of which helper produced it. */
function baseHeaders(): Headers {
  const headers = new Headers();
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

function bodyResponse(
  body: string,
  status: number,
  method: string,
  contentType: string,
  etag?: string,
): Response {
  const headers = baseHeaders();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "no-store");
  if (etag) headers.set("ETag", etag);

  headers.set("Content-Length", String(Buffer.byteLength(body)));
  if (method.toUpperCase() === "HEAD") {
    return new Response(null, { status, headers });
  }
  return new Response(body, { status, headers });
}

export function htmlResponse(
  body: string,
  status: number,
  method: string,
): Response {
  return bodyResponse(body, status, method, "text/html; charset=utf-8");
}

export function jsonResponse(
  body: unknown,
  status: number,
  method: string,
  etag?: string,
): Response {
  return bodyResponse(
    JSON.stringify(body),
    status,
    method,
    "application/json; charset=utf-8",
    etag,
  );
}

export function textResponse(
  body: string,
  status: number,
  method: string,
): Response {
  return bodyResponse(body, status, method, "text/plain; charset=utf-8");
}

export function jsonError(
  status: number,
  message: string,
  method: string,
): Response {
  const payload: contracts.ApiErrorPayload = { error: { status, message } };
  return jsonResponse(payload, status, method);
}

type ByteRange = {
  start: number;
  end: number;
};

type RangeResult = ByteRange | "unsatisfiable" | null;

/**
 * Parse a single `bytes` range. Unsupported units and multi-range requests are
 * ignored (full response); only syntactically valid but unsatisfiable ranges
 * become 416.
 */
function parseRange(header: string | null, size: number): RangeResult {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match) return null;

  const [, startText = "", endText = ""] = match;
  if (startText === "" && endText === "") return null;

  if (startText === "") {
    const suffix = Number(endText);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return "unsatisfiable";
    // Bun serves an empty file for a suffix range; keep that behavior.
    if (size === 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  if (size === 0) return "unsatisfiable";

  const start = Number(startText);
  if (!Number.isSafeInteger(start) || start >= size) return "unsatisfiable";
  if (endText === "") return { start, end: size - 1 };

  const end = Number(endText);
  if (!Number.isSafeInteger(end)) return null;
  // A reversed range is malformed; Bun ignores it and serves the full file.
  if (end < start) return null;

  return { start, end: Math.min(end, size - 1) };
}

/**
 * Evaluate If-Range before applying a Range. A weak ETag never satisfies
 * If-Range; file responses use a strong ETag, while date validators are also
 * accepted.
 */
function ifRangeMatches(
  header: string | null,
  validators: ReturnType<typeof computeValidators>,
  stats: fs.Stats,
): boolean {
  if (!header) return true;

  const value = header.trim();
  if (value.startsWith("W/")) return false;
  if (value.startsWith('"')) return value === validators.etag;

  const since = Date.parse(value);
  if (!Number.isFinite(since)) return false;
  return Math.floor(stats.mtime.getTime() / 1000) <= Math.floor(since / 1000);
}

/** Add the UTF-8 charset Bun used to infer for textual file responses. */
function fileType(filePath: string, contentType?: string): string {
  if (contentType) return contentType;

  const type = mime.getType(filePath) ?? "application/octet-stream";
  return type.startsWith("text/") || type === "application/json"
    ? `${type}; charset=utf-8`
    : type;
}

/**
 * Serve a file with validators and single-range support. The Node HTTP layer
 * does not synthesize file responses, so MIME type, Content-Length, Range and
 * HEAD body handling all happen here.
 */
export function fileResponse(
  file: { path: string; stats: fs.Stats },
  request: Request,
  contentType?: string,
): Response {
  const method = request.method.toUpperCase();
  const headers = baseHeaders();
  headers.set("Content-Type", fileType(file.path, contentType));

  const validators = computeValidators(file.stats);
  applyValidators(headers, validators);
  if (isNotModified(request, validators, file.stats)) {
    return new Response(null, { status: 304, headers });
  }

  const range = parseRange(request.headers.get("range"), file.stats.size);
  const applyRange =
    range !== null &&
    ifRangeMatches(request.headers.get("if-range"), validators, file.stats);

  if (applyRange && range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${file.stats.size}`);
    return new Response(null, { status: 416, headers });
  }

  if (applyRange && range !== null && range !== "unsatisfiable") {
    const length = range.end - range.start + 1;
    headers.set(
      "Content-Range",
      `bytes ${range.start}-${range.end}/${file.stats.size}`,
    );
    headers.set("Content-Length", String(length));
    if (method === "HEAD") {
      return new Response(null, { status: 206, headers });
    }
    return new Response(
      stream.Readable.toWeb(
        fs.createReadStream(file.path, { start: range.start, end: range.end }),
      ) as ReadableStream,
      { status: 206, headers },
    );
  }

  headers.set("Content-Length", String(file.stats.size));
  if (method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  return new Response(
    stream.Readable.toWeb(fs.createReadStream(file.path)) as ReadableStream,
    { headers },
  );
}

export function redirectResponse(location: string, method: string): Response {
  const headers = baseHeaders();
  headers.set("Location", location);
  return new Response(method === "HEAD" ? null : "", { status: 301, headers });
}

export function methodNotAllowedResponse(): Response {
  const headers = baseHeaders();
  headers.set("Allow", "GET, HEAD");
  return new Response("Method Not Allowed", { status: 405, headers });
}

export function notModifiedResponse(etag: string): Response {
  const headers = baseHeaders();
  headers.set("Cache-Control", "no-store");
  headers.set("ETag", etag);
  return new Response(null, { status: 304, headers });
}
