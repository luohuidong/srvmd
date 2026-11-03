import type { contracts } from "@shared";
import { constants } from "@shared";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type FetchPageOptions = {
  signal?: AbortSignal;
  etag?: string | null;
};

export type FetchPageResult =
  | { status: "ok"; page: contracts.PagePayload; etag: string | null }
  | { status: "not-modified"; etag: string | null };

export async function fetchPage(
  pathname: string,
  options: FetchPageOptions = {},
): Promise<FetchPageResult> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.etag) headers["If-None-Match"] = options.etag;

  const response = await fetch(`${constants.API_PAGE_PATH}${pathname}`, {
    signal: options.signal,
    headers,
  });

  if (response.status === 304) {
    return { status: "not-modified", etag: response.headers.get("etag") };
  }

  if (!response.ok) {
    let message =
      response.statusText || `Request failed with ${response.status}`;
    try {
      const payload = (await response.json()) as contracts.ApiErrorPayload;
      if (payload.error?.message) message = payload.error.message;
    } catch {
      // Keep the HTTP status text when the body is not JSON.
    }
    throw new ApiError(response.status, message);
  }

  return {
    status: "ok",
    page: (await response.json()) as contracts.PagePayload,
    etag: response.headers.get("etag"),
  };
}
