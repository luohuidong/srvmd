import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { contracts } from "../../../shared/src/index.js";
import {
  createServerFixture,
  type ServerFixture,
} from "../../test/server-fixture.js";
import { startServer } from "../create-server.js";

let fixture: ServerFixture;
let running: Awaited<ReturnType<typeof startServer>>;
let base: string;

function page(pathname: string, init?: RequestInit): Promise<Response> {
  return fetch(`${base}/__api/page${pathname}`, init);
}

async function pagePayload<T extends contracts.PagePayload>(
  pathname: string,
): Promise<T> {
  const response = await page(pathname);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(response.headers.get("cache-control")).toBe("no-store");
  return (await response.json()) as T;
}

beforeAll(async () => {
  fixture = await createServerFixture("serve-md-page-api-");

  await fixture.seed("page.md", "# Page\n\noriginal\n");
  await fixture.seed(
    "code.md",
    "# Code\n\n```ts\nexport const value = 1;\n```\n",
  );
  await fixture.seed(
    "diagram.md",
    "# Diagram\n\n```mermaid\ngraph TD\n  A --> B\n```\n",
  );
  await fixture.seed("cache.md", "# Cache\n\nbefore\n");
  await fixture.seed("guide/index.md", "# Guide\n\n## One\n\n## Two\n");
  await fixture.seed("nav/one.md", "# One\n");
  await fixture.seed("nav/two.md", "# Two\n");
  await fixture.seed("nav/with space.md", "# Spaced\n");
  await fixture.seed("nav/notes.txt", "notes");
  await fixture.seed("nav/nested/three.md", "# Three\n");
  await fixture.seed("sub/index.md", "# Sub Home\n");
  await fixture.seed("listing/a.txt", "a");
  await fixture.seed("empty/.keep", "");
  await fixture.seed("etag.md", "# Etag\n\nbefore\n");
  await fixture.seed("etag-other.md", "# Other\n");

  running = await startServer({
    root: fixture.root,
    port: 0,
    ignore: [],
    web: { kind: "dist", root: fixture.webRoot },
  });
  base = running.url;
});

afterAll(async () => {
  running?.close();
  await fixture?.cleanup();
});

describe("document payloads", () => {
  test("returns structured document data", async () => {
    const payload = await pagePayload<contracts.DocumentPayload>("/page.md");

    expect(payload.kind).toBe("document");
    expect(payload.title).toBe("Page");
    expect(payload.html).toContain('<h1 id="page"');
    expect(payload.html).toContain("original");
    expect(payload.rawHref).toBe("/page.md?raw");
    expect(payload.breadcrumbs).toEqual([
      { label: "Home", href: "/" },
      { label: "page.md", href: "/page.md" },
    ]);
  });

  test("appends the file name after its directory breadcrumbs", async () => {
    const payload =
      await pagePayload<contracts.DocumentPayload>("/guide/index.md");

    expect(payload.breadcrumbs).toEqual([
      { label: "Home", href: "/" },
      { label: "guide", href: "/guide/" },
      { label: "index.md", href: "/guide/index.md" },
    ]);
  });

  test("lists sibling Markdown documents in the page directory", async () => {
    const payload = await pagePayload<contracts.DocumentPayload>("/nav/one.md");

    expect(payload.siblings).toEqual([
      { name: "one.md", href: "/nav/one.md", active: true },
      { name: "two.md", href: "/nav/two.md", active: false },
      { name: "with space.md", href: "/nav/with%20space.md", active: false },
    ]);
  });

  test("changes the ETag when a sibling Markdown file is added", async () => {
    const first = await page("/nav/one.md");
    const etag = first.headers.get("etag") ?? "";

    await fixture.seed("nav/three.md", "# Three\n");

    const second = await page("/nav/one.md", {
      headers: { "if-none-match": etag },
    });
    expect(second.status).toBe(200);
    expect(second.headers.get("etag")).not.toBe(etag);

    const payload = (await second.json()) as contracts.DocumentPayload;
    expect(payload.siblings.map(entry => entry.name)).toContain("three.md");
  });

  test("renders code blocks with shiki", async () => {
    const payload = await pagePayload<contracts.DocumentPayload>("/code.md");

    expect(payload.html).toContain('class="shiki');
    expect(payload.html).toContain("--shiki-dark");
  });

  test("extracts Mermaid sources and emits slots", async () => {
    const payload = await pagePayload<contracts.DocumentPayload>("/diagram.md");

    expect(payload.mermaid).toHaveLength(1);
    expect(payload.mermaid[0]?.id).toBe("mermaid-1");
    expect(payload.mermaid[0]?.source).toContain("graph TD");
    expect(payload.html).toContain('data-mermaid-slot="mermaid-1"');
    expect(payload.html).not.toContain("mermaid-figure");
  });
});

describe("directory payloads", () => {
  test("returns directory entries", async () => {
    const payload = await pagePayload<contracts.DirectoryPayload>("/listing/");

    expect(payload.kind).toBe("directory");
    expect(payload.heading).toBe("Index of /listing/");
    expect(payload.parentHref).toBe("../");
    expect(payload.entries.map(entry => entry.name)).toEqual(["a.txt"]);
    expect(payload.entries[0]?.kind).toBe("file");
    expect(payload.entries[0]?.mtime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("lists directories even when they contain an index file", async () => {
    const payload = await pagePayload<contracts.DirectoryPayload>("/guide/");

    expect(payload.kind).toBe("directory");
    expect(payload.entries.map(entry => entry.name)).toContain("index.md");
  });

  test("returns a payload for an empty directory", async () => {
    const payload = await pagePayload<contracts.DirectoryPayload>("/empty/");

    expect(payload.kind).toBe("directory");
    expect(payload.heading).toBe("Index of /empty/");
    expect(payload.entries).toEqual([]);
  });

  test("returns a redirect payload for a directory without a trailing slash", async () => {
    const payload = await pagePayload<contracts.RedirectPayload>("/sub");

    expect(payload.kind).toBe("redirect");
    expect(payload.location).toBe("/sub/");
  });

  test("returns JSON errors", async () => {
    const response = await page("/missing");
    expect(response.status).toBe(404);

    const payload = (await response.json()) as contracts.ApiErrorPayload;
    expect(payload.error.status).toBe(404);
    expect(payload.error.message.length).toBeGreaterThan(0);
  });
});

describe("conditional requests", () => {
  test("answers conditional document requests with 304", async () => {
    const first = await page("/etag.md");
    expect(first.status).toBe(200);

    const etag = first.headers.get("etag");
    expect(etag).toMatch(/^W\//);

    const cached = await page("/etag.md", {
      headers: { "if-none-match": etag ?? "" },
    });
    expect(cached.status).toBe(304);
    expect(cached.headers.get("etag")).toBe(etag);
    expect(await cached.text()).toBe("");
  });

  test("answers HEAD conditional requests with 304", async () => {
    const first = await page("/etag-other.md");
    const etag = first.headers.get("etag") ?? "";

    const cached = await page("/etag-other.md", {
      method: "HEAD",
      headers: { "if-none-match": etag },
    });
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe("");
  });

  test("does not accept another document's ETag", async () => {
    const first = await page("/etag-other.md");
    const etag = first.headers.get("etag") ?? "";

    const response = await page("/page.md", {
      headers: { "if-none-match": etag },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).not.toBe(etag);
  });

  test("changes the ETag after a document edit", async () => {
    const first = await page("/etag.md");
    const etag = first.headers.get("etag");

    await fixture.seed("etag.md", "# Etag\n\nafter\n");

    const second = await page("/etag.md", {
      headers: { "if-none-match": etag ?? "" },
    });
    expect(second.status).toBe(200);
    expect(second.headers.get("etag")).not.toBe(etag);

    const payload = (await second.json()) as contracts.DocumentPayload;
    expect(payload.html).toContain("after");
  });

  test("answers conditional directory requests with 304", async () => {
    const first = await page("/listing/");
    expect(first.status).toBe(200);

    const etag = first.headers.get("etag");
    expect(etag).toMatch(/^W\//);

    const cached = await page("/listing/", {
      headers: { "if-none-match": etag ?? "" },
    });
    expect(cached.status).toBe(304);
  });
});

describe("cache freshness", () => {
  test("re-renders after a file changes", async () => {
    const first = await pagePayload<contracts.DocumentPayload>("/cache.md");
    expect(first.html).toContain("before");

    await fixture.seed("cache.md", "# Cache\n\nafter\n");

    const second = await pagePayload<contracts.DocumentPayload>("/cache.md");
    expect(second.html).toContain("after");
  });
});
