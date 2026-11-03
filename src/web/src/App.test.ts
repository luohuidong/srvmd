import type { contracts } from "@shared";
import { render } from "@testing-library/svelte";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchPage: vi.fn() }));

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

// App always connects to the live hub; keep these rendering tests off the network.
vi.mock("./features/live/live.ts", async importOriginal => {
  const actual =
    await importOriginal<typeof import("./features/live/live.ts")>();
  return { ...actual, connectLive: () => () => undefined };
});

import App from "./App.svelte";

const documentPage: contracts.DocumentPayload = {
  kind: "document",
  title: "Home",
  html: '<h1 id="home">Home</h1><p>Welcome</p>',
  toc: [{ level: 1, id: "home", text: "Home" }],
  siblings: [
    { name: "index.md", href: "/index.md", active: true },
    { name: "guide.md", href: "/guide.md", active: false },
  ],
  mermaid: [],
  breadcrumbs: [{ label: "Home", href: "/" }],
  rawHref: "/?raw",
};

const directoryPage: contracts.DirectoryPayload = {
  kind: "directory",
  heading: "Index of /",
  entries: [
    {
      name: "a.md",
      kind: "markdown",
      size: 12,
      mtime: "2026-01-02T03:04:00.000Z",
    },
  ],
  breadcrumbs: [{ label: "Home", href: "/" }],
};

beforeEach(() => {
  mocks.fetchPage.mockReset();
  document.title = "srvmd";
});

describe("App", () => {
  test("loads and renders a document page", async () => {
    mocks.fetchPage.mockResolvedValue({
      status: "ok",
      page: documentPage,
      etag: null,
    });

    const { container } = render(App);

    await vi.waitFor(() => {
      expect(container.querySelector(".markdown-body h1")?.textContent).toBe(
        "Home",
      );
    });

    expect(container.textContent).toContain("Welcome");
    expect(container.querySelector('a[href="/?raw"]')).not.toBeNull();
    expect(document.title).toBe("Home");
    expect(mocks.fetchPage).toHaveBeenCalledTimes(1);
  });

  test("renders a directory page", async () => {
    mocks.fetchPage.mockResolvedValue({
      status: "ok",
      page: directoryPage,
      etag: null,
    });

    const { container } = render(App);

    await vi.waitFor(() => {
      expect(container.querySelector(".listing h1")?.textContent).toBe(
        "Index of /",
      );
    });

    expect(container.textContent).toContain("a.md");
    expect(container.querySelector('a[href="a.md"]')).not.toBeNull();
  });

  test("renders an API error page", async () => {
    const { ApiError } = await import("$lib/api");
    mocks.fetchPage.mockRejectedValue(new ApiError(404, "Not found"));

    const { container } = render(App);

    await vi.waitFor(() => {
      expect(container.querySelector(".error-code")?.textContent).toBe("404");
    });

    expect(container.textContent).toContain("Page not found");
  });
  test("shows a loading state before the page arrives", async () => {
    let resolvePage!: (result: {
      status: "ok";
      page: contracts.DocumentPayload;
      etag: string | null;
    }) => void;
    mocks.fetchPage.mockReturnValue(
      new Promise<{
        status: "ok";
        page: contracts.DocumentPayload;
        etag: string | null;
      }>(resolve => {
        resolvePage = resolve;
      }),
    );

    const { container } = render(App);
    expect(container.textContent).toContain("Loading…");

    resolvePage({ status: "ok", page: documentPage, etag: null });
    await vi.waitFor(() => {
      expect(container.querySelector(".markdown-body h1")?.textContent).toBe(
        "Home",
      );
    });
  });
});
