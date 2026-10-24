import type { ApiErrorPayload } from "../../shared/contracts.ts";
import type { ResolvedPath } from "../types.ts";
import { baseHeaders } from "./headers.ts";
import { applyValidators, computeValidators, isNotModified } from "./validators.ts";

export function htmlResponse(body: string, status: number, method: string, cors: boolean): Response {
  const headers = baseHeaders(cors);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  if (method === "HEAD") {
    headers.set("Content-Length", String(Buffer.byteLength(body)));
    return new Response(null, { status, headers });
  }
  return new Response(body, { status, headers });
}

/**
 * Serve a file with validators. Bun's manual file responses handle Range
 * requests but not ETag/Last-Modified, so add them (and 304s) here.
 */
export function fileResponse(file: ResolvedPath, request: Request, cors: boolean, contentType?: string): Response {
  const headers = baseHeaders(cors);
  if (contentType) headers.set("Content-Type", contentType);

  const validators = computeValidators(file.stats);
  applyValidators(headers, validators);
  if (isNotModified(request, validators, file.stats)) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(Bun.file(file.path), { headers });
}

export function redirectResponse(location: string, method: string, cors: boolean): Response {
  const headers = baseHeaders(cors);
  headers.set("Location", location);
  return new Response(method === "HEAD" ? null : "", { status: 301, headers });
}

export function preflightResponse(cors: boolean): Response {
  return new Response(null, { status: 204, headers: baseHeaders(cors) });
}

export function methodNotAllowedResponse(cors: boolean): Response {
  const headers = baseHeaders(cors);
  headers.set("Allow", "GET, HEAD, OPTIONS");
  return new Response("Method Not Allowed", { status: 405, headers });
}

function bodyResponse(
  body: string,
  status: number,
  method: string,
  cors: boolean,
  contentType: string,
  etag?: string,
): Response {
  const headers = baseHeaders(cors);
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "no-store");
  if (etag) headers.set("ETag", etag);

  if (method === "HEAD") {
    headers.set("Content-Length", String(Buffer.byteLength(body)));
    return new Response(null, { status, headers });
  }

  return new Response(body, { status, headers });
}

export function jsonResponse(body: unknown, status: number, method: string, cors: boolean, etag?: string): Response {
  return bodyResponse(JSON.stringify(body), status, method, cors, "application/json; charset=utf-8", etag);
}

export function notModifiedResponse(etag: string, cors: boolean): Response {
  const headers = baseHeaders(cors);
  headers.set("Cache-Control", "no-store");
  headers.set("ETag", etag);
  return new Response(null, { status: 304, headers });
}

export function jsonError(status: number, message: string, method: string, cors: boolean): Response {
  const payload: ApiErrorPayload = { error: { status, message } };
  return jsonResponse(payload, status, method, cors);
}

export function textResponse(body: string, status: number, method: string, cors: boolean): Response {
  return bodyResponse(body, status, method, cors, "text/plain; charset=utf-8");
}
