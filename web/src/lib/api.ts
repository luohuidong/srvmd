import { API_PAGE_PATH } from "@shared/constants.ts";
import type { ApiErrorPayload, PagePayload } from "@shared/contracts.ts";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function fetchPage(pathname: string, signal?: AbortSignal): Promise<PagePayload> {
  const response = await fetch(`${API_PAGE_PATH}${pathname}`, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    let message = response.statusText || `Request failed with ${response.status}`;
    try {
      const payload = (await response.json()) as ApiErrorPayload;
      if (payload.error?.message) message = payload.error.message;
    } catch {
      // Keep the HTTP status text when the body is not JSON.
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as PagePayload;
}
