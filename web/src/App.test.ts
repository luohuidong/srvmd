import type { DirectoryPayload, DocumentPayload } from "@shared/contracts.ts";
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

import App from "./App.svelte";

const documentPage: DocumentPayload = {
  kind: "document",
  path: "/",
  title: "Home",
  html: '<h1 id="home">Home</h1><p>Welcome</p>',
  toc: [{ level: 1, id: "home", text: "Home" }],
  mermaid: [],
  breadcrumbs: [{ label: "docs", href: "/" }],
  rawHref: "/?raw",
};

const directoryPage: DirectoryPayload = {
  kind: "directory",
  path: "/",
  heading: "Index of /",
  entries: [{ name: "a.md", kind: "markdown", size: 12, mtime: "2026-01-02T03:04:00.000Z" }],
  breadcrumbs: [{ label: "docs", href: "/" }],
};

beforeEach(() => {
  mocks.fetchPage.mockReset();
  document.title = "serve-markdown";
});

describe("App", () => {
  test("loads and renders a document page", async () => {
    mocks.fetchPage.mockResolvedValue(documentPage);

    const { container } = render(App);

    await vi.waitFor(() => {
      expect(container.querySelector(".markdown-body h1")?.textContent).toBe("Home");
    });

    expect(container.textContent).toContain("Welcome");
    expect(container.querySelector('a[href="/?raw"]')).not.toBeNull();
    expect(document.title).toBe("Home");
    expect(mocks.fetchPage).toHaveBeenCalledTimes(1);
  });

  test("renders a directory page", async () => {
    mocks.fetchPage.mockResolvedValue(directoryPage);

    const { container } = render(App);

    await vi.waitFor(() => {
      expect(container.querySelector(".listing h1")?.textContent).toBe("Index of /");
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
    let resolvePage!: (page: DocumentPayload) => void;
    mocks.fetchPage.mockReturnValue(
      new Promise<DocumentPayload>(resolve => {
        resolvePage = resolve;
      }),
    );

    const { container } = render(App);
    expect(container.textContent).toContain("Loading…");

    resolvePage(documentPage);
    await vi.waitFor(() => {
      expect(container.querySelector(".markdown-body h1")?.textContent).toBe("Home");
    });
  });
});
