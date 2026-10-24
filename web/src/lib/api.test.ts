import type { DocumentPayload } from "@shared/contracts.ts";
import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchPage } from "./api.ts";

const payload: DocumentPayload = {
  kind: "document",
  path: "/guide/setup",
  title: "Setup",
  html: "<h1>Setup</h1>",
  toc: [],
  mermaid: [],
  breadcrumbs: [{ label: "docs", href: "/" }],
  rawHref: "/guide/setup?raw",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchPage", () => {
  test("requests the page API with the current pathname", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json", ETag: 'W/"abc"' },
      }),
    );

    await expect(fetchPage("/guide/setup")).resolves.toEqual({
      status: "ok",
      page: payload,
      etag: 'W/"abc"',
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/__api/page/guide/setup",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  test("sends If-None-Match and handles 304", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 304 }));

    await expect(fetchPage("/guide/setup", { etag: 'W/"abc"' })).resolves.toEqual({
      status: "not-modified",
      etag: null,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/__api/page/guide/setup",
      expect.objectContaining({
        headers: { Accept: "application/json", "If-None-Match": 'W/"abc"' },
      }),
    );
  });

  test("keeps the ETag a 304 reports", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 304, headers: { ETag: 'W/"abc"' } }));

    await expect(fetchPage("/guide/setup", { etag: 'W/"old"' })).resolves.toEqual({
      status: "not-modified",
      etag: 'W/"abc"',
    });
  });

  test("throws ApiError with the server message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { status: 404, message: "Not found" } }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchPage("/missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "Not found",
    });
  });
});
