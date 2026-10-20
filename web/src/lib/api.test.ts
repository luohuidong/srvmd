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
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchPage("/guide/setup")).resolves.toEqual(payload);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/__api/page/guide/setup",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
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
