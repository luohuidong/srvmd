import type { contracts } from "@shared";
import { render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchPage: vi.fn(),
  connectLive: vi.fn(),
  reload: undefined as ((files: string[]) => void) | undefined,
}));

vi.mock("$lib/api", () => ({
  ApiError: class ApiError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
  fetchPage: mocks.fetchPage,
}));

vi.mock("./features/live/live.ts", async importOriginal => {
  const actual =
    await importOriginal<typeof import("./features/live/live.ts")>();
  return {
    ...actual,
    connectLive: (
      callback: (event: { type: "reload"; files: string[] }) => void,
    ) => {
      mocks.connectLive(callback);
      mocks.reload = files => callback({ type: "reload", files });
      return () => undefined;
    },
  };
});

import App from "./App.svelte";

function page(content: string): contracts.DocumentPayload {
  return {
    kind: "document",
    title: "Live",
    html: `<h1 id="live">${content}</h1>`,
    toc: [{ level: 1, id: "live", text: "Live" }],
    siblings: [],
    mermaid: [],
    breadcrumbs: [{ label: "Home", href: "/" }],
    rawHref: "/?raw",
  };
}

function ok(payload: contracts.DocumentPayload, etag = 'W/"1"') {
  return { status: "ok" as const, page: payload, etag };
}

beforeEach(() => {
  mocks.fetchPage.mockReset();
  mocks.connectLive.mockReset();
  mocks.reload = undefined;
  document.title = "srvmd";
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("App live reload", () => {
  test("connects to the live hub and refetches the current page", async () => {
    mocks.fetchPage
      .mockResolvedValueOnce(ok(page("before")))
      .mockResolvedValueOnce(ok(page("after"), 'W/"2"'));

    const { container } = render(App);

    await vi.waitFor(() => {
      expect(container.querySelector(".markdown-body h1")?.textContent).toBe(
        "before",
      );
    });

    expect(mocks.connectLive).toHaveBeenCalledTimes(1);
    expect(mocks.fetchPage).toHaveBeenCalledTimes(1);

    mocks.reload?.(["index.md"]);

    await vi.waitFor(() => {
      expect(container.querySelector(".markdown-body h1")?.textContent).toBe(
        "after",
      );
    });

    expect(mocks.fetchPage).toHaveBeenCalledTimes(2);
    expect(mocks.fetchPage).toHaveBeenLastCalledWith(
      "/",
      expect.objectContaining({ etag: 'W/"1"' }),
    );
  });

  test("keeps the current content when the server returns 304", async () => {
    mocks.fetchPage
      .mockResolvedValueOnce(ok(page("before")))
      .mockResolvedValueOnce({
        status: "not-modified",
        etag: 'W/"1"',
      });

    const { container } = render(App);

    await vi.waitFor(() => {
      expect(container.querySelector(".markdown-body h1")?.textContent).toBe(
        "before",
      );
    });

    mocks.reload?.(["index.md"]);

    await vi.waitFor(() => {
      expect(mocks.fetchPage).toHaveBeenCalledTimes(2);
    });

    expect(container.querySelector(".markdown-body h1")?.textContent).toBe(
      "before",
    );
  });

  test("ignores a live event for an unrelated file", async () => {
    window.history.replaceState({}, "", "/guide");
    mocks.fetchPage.mockResolvedValueOnce(ok(page("before")));

    const { container } = render(App);

    await vi.waitFor(() => {
      expect(container.querySelector(".markdown-body h1")?.textContent).toBe(
        "before",
      );
    });

    mocks.reload?.(["sub/other.md"]);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mocks.fetchPage).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".markdown-body h1")?.textContent).toBe(
      "before",
    );
  });

  test("refetches when the root index changes", async () => {
    mocks.fetchPage
      .mockResolvedValueOnce(ok(page("before")))
      .mockResolvedValueOnce(ok(page("after"), 'W/"2"'));

    const { container } = render(App);

    await vi.waitFor(() => {
      expect(container.querySelector(".markdown-body h1")?.textContent).toBe(
        "before",
      );
    });

    mocks.reload?.(["index.md"]);

    await vi.waitFor(() => {
      expect(container.querySelector(".markdown-body h1")?.textContent).toBe(
        "after",
      );
    });
  });
});
