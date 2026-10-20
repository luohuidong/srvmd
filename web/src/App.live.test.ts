import type { DocumentPayload } from "@shared/contracts.ts";
import { render } from "@testing-library/svelte";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchPage: vi.fn(),
  connectLive: vi.fn(),
  reload: undefined as (() => void) | undefined,
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

vi.mock("$lib/config", () => ({
  appConfig: {
    rootLabel: "docs",
    version: "0.0.0",
    theme: "auto",
    live: true,
    mermaid: true,
  },
}));

vi.mock("./features/live/live.ts", () => ({
  connectLive: (callback: () => void) => {
    mocks.connectLive(callback);
    mocks.reload = callback;
    return () => undefined;
  },
}));

import App from "./App.svelte";

function page(content: string): DocumentPayload {
  return {
    kind: "document",
    path: "/",
    title: "Live",
    html: `<h1 id="live">${content}</h1>`,
    toc: [{ level: 1, id: "live", text: "Live" }],
    mermaid: [],
    breadcrumbs: [{ label: "docs", href: "/" }],
    rawHref: "/?raw",
  };
}

beforeEach(() => {
  mocks.fetchPage.mockReset();
  mocks.connectLive.mockReset();
  mocks.reload = undefined;
  document.title = "serve-markdown";
});

describe("App live reload", () => {
  test("connects to the live hub and refetches the current page", async () => {
    mocks.fetchPage.mockResolvedValueOnce(page("before")).mockResolvedValueOnce(page("after"));

    const { container } = render(App);

    await vi.waitFor(() => {
      expect(container.querySelector(".markdown-body h1")?.textContent).toBe("before");
    });

    expect(mocks.connectLive).toHaveBeenCalledTimes(1);
    expect(mocks.fetchPage).toHaveBeenCalledTimes(1);

    mocks.reload?.();

    await vi.waitFor(() => {
      expect(container.querySelector(".markdown-body h1")?.textContent).toBe("after");
    });

    expect(mocks.fetchPage).toHaveBeenCalledTimes(2);
  });
});
