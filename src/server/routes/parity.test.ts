import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServerFixture, type ServerFixture } from "../../../test/server-fixture.ts";
import { LIVE_PATH, MERMAID_RUNTIME_PATH } from "../../shared/constants.ts";
import type { AppConfig, DirectoryPayload, DocumentPayload, RedirectPayload } from "../../shared/contracts.ts";
import type { ServeMarkdownOptions } from "../config.ts";
import { type RunningServer, startServer } from "../create-server.ts";

let fixture: ServerFixture;
let running: RunningServer;
let base: string;

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  return (await response.json()) as T;
}

function shellConfig(html: string): AppConfig {
  const match = /<script id="serve-md-config" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!match?.[1]) throw new Error("Shell config was not injected");
  return JSON.parse(match[1]) as AppConfig;
}

async function withServer(
  options: Partial<ServeMarkdownOptions>,
  run: (server: RunningServer) => Promise<void>,
): Promise<void> {
  const server = await startServer({
    root: fixture.root,
    port: 0,
    hostname: "127.0.0.1",
    highlight: false,
    live: false,
    webRoot: fixture.webRoot,
    ...options,
  });

  try {
    await run(server);
  } finally {
    server.close();
  }
}

beforeAll(async () => {
  fixture = await createServerFixture("serve-md-parity-");

  await fixture.seed("index.md", "# Home\n\nwelcome\n");
  await fixture.seed("page.md", "# Page\n\noriginal\n");
  await fixture.seed("code.md", "# Code\n\n```ts\nexport const value = 1;\n```\n");
  await fixture.seed("diagram.md", "# Diagram\n\n```mermaid\ngraph TD\n  A --> B\n```\n");
  await fixture.seed("unsafe.md", "<script>alert(1)</script>\n\n# Safe\n");
  await fixture.seed("cache.md", "# Cache\n\nbefore\n");
  await fixture.seed("guide/index.md", "# Guide\n\n## One\n\n## Two\n");
  await fixture.seed("sub/index.md", "# Sub Home\n");
  await fixture.seed("noindex/hello.txt", "hi");
  await fixture.seed("empty/.keep", "");
  await fixture.seed("htmlindex/index.html", "<!doctype html><html><body><h1>HTML index</h1></body></html>");
  await fixture.seed("plain.txt", "hello static");
  await fixture.seed("static.html", "<!doctype html><html><body><h1>Static</h1></body></html>");
  await fixture.seed(".hidden.md", "hidden");

  running = await startServer({
    root: fixture.root,
    port: 0,
    hostname: "127.0.0.1",
    highlight: false,
    live: false,
    webRoot: fixture.webRoot,
  });
  base = running.url;
});

afterAll(async () => {
  running?.close();
  await fixture?.cleanup();
});

describe("baseline parity", () => {
  test("injects live/theme/mermaid state into the shell config", async () => {
    const html = await (await fetch(`${base}/page.md`)).text();
    const config = shellConfig(html);

    expect(config.live).toBe(false);
    expect(config.single).toBe(false);
    expect(config.mermaid).toBe(true);
    expect(config.theme).toBe("auto");
    expect(config.rootLabel.length).toBeGreaterThan(0);
  });

  test("supports ?raw through clean URLs", async () => {
    const response = await fetch(`${base}/page?raw`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(await response.text()).toContain("# Page");
  });

  test("keeps the query string when redirecting a directory", async () => {
    const response = await fetch(`${base}/sub?tab=2`, { redirect: "manual" });
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/sub/?tab=2");
  });

  test("returns a redirect payload from the page API", async () => {
    const payload = await api<RedirectPayload>(`${base}/__api/page/sub`);
    expect(payload.kind).toBe("redirect");
    expect(payload.location).toBe("/sub/");
  });

  test("serves static HTML with live reload disabled", async () => {
    const response = await fetch(`${base}/static.html`);
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain("<h1>Static</h1>");
    expect(html).not.toContain(LIVE_PATH);
    expect(html).not.toContain("live-static.js");
  });

  test("serves a directory index.html directly, without the Svelte shell", async () => {
    const response = await fetch(`${base}/htmlindex/`);
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain("<h1>HTML index</h1>");
    expect(html).not.toContain('id="app"');
  });

  test("returns directory data for an empty directory", async () => {
    const shell = await fetch(`${base}/empty/`);
    expect(shell.status).toBe(200);

    const payload = await api<DirectoryPayload>(`${base}/__api/page/empty/`);
    expect(payload.kind).toBe("directory");
    expect(payload.heading).toBe("Index of /empty/");
    expect(payload.entries).toEqual([]);
  });

  test("answers HEAD for static files with the real size", async () => {
    const response = await fetch(`${base}/plain.txt`, { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("12");
    expect(await response.text()).toBe("");
  });

  test("honors If-Modified-Since", async () => {
    const first = await fetch(`${base}/plain.txt`);
    const lastModified = first.headers.get("last-modified");
    expect(lastModified).not.toBeNull();

    const second = await fetch(`${base}/plain.txt`, {
      headers: { "If-Modified-Since": lastModified ?? "" },
    });
    expect(second.status).toBe(304);
  });

  test("does not serve hidden files", async () => {
    const response = await fetch(`${base}/.hidden.md`);
    expect(response.status).toBe(404);
  });

  test("returns 400 for malformed escapes and null bytes", async () => {
    const nullByte = await fetch(`${base}/%00`);
    expect(nullByte.status).toBe(400);

    const malformed = await fetch(`${base}/%E0%A4%A`);
    expect(malformed.status).toBe(400);

    const apiMalformed = await fetch(`${base}/__api/page/%00`);
    expect(apiMalformed.status).toBe(400);
  });

  test("does not serve traversal paths", async () => {
    const response = await fetch(`${base}/%2e%2e%2f%2e%2e%2fetc%2fpasswd`);
    expect(response.status).not.toBe(200);
  });

  test("re-renders after a file changes", async () => {
    const first = await api<DocumentPayload>(`${base}/__api/page/cache.md`);
    expect(first.html).toContain("before");

    await fixture.seed("cache.md", "# Cache\n\nafter\n");

    const second = await api<DocumentPayload>(`${base}/__api/page/cache.md`);
    expect(second.html).toContain("after");
  });

  test("keeps highlighting disabled for the integration fixture", async () => {
    const payload = await api<DocumentPayload>(`${base}/__api/page/code.md`);
    expect(payload.html).not.toContain('class="shiki');
    expect(payload.html).toContain('<pre><code class="language-ts">');
  });

  test("returns 426 for the live path when live reload is disabled", async () => {
    const response = await fetch(`${base}${LIVE_PATH}`);
    expect(response.status).toBe(426);
  });

  test("rejects unsupported methods", async () => {
    const post = await fetch(`${base}/page.md`, { method: "POST" });
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toContain("GET");

    const options = await fetch(`${base}/page.md`, { method: "OPTIONS" });
    expect(options.status).toBe(405);
  });
});

describe("option parity", () => {
  test("--no-mermaid leaves source code blocks and hides the runtime", async () => {
    await withServer({ mermaid: false }, async server => {
      const shell = await (await fetch(`${server.url}/diagram.md`)).text();
      expect(shellConfig(shell).mermaid).toBe(false);

      const payload = await api<DocumentPayload>(`${server.url}/__api/page/diagram.md`);
      expect(payload.mermaid).toEqual([]);
      expect(payload.html).toContain('<pre><code class="language-mermaid">');
      expect(payload.html).not.toContain("data-mermaid-slot");

      const asset = await fetch(`${server.url}${MERMAID_RUNTIME_PATH}`);
      expect(asset.status).toBe(404);
    });
  });

  test("--no-directory-listing keeps index documents but hides generated listings", async () => {
    await withServer({ directoryListing: false }, async server => {
      const index = await api<DocumentPayload>(`${server.url}/__api/page/guide/`);
      expect(index.kind).toBe("document");
      expect(index.title).toBe("Guide");

      const listingShell = await fetch(`${server.url}/noindex/`);
      expect(listingShell.status).toBe(404);

      const listingApi = await fetch(`${server.url}/__api/page/noindex/`);
      expect(listingApi.status).toBe(404);

      const htmlIndex = await fetch(`${server.url}/htmlindex/`);
      expect(htmlIndex.status).toBe(200);
      expect(await htmlIndex.text()).toContain("HTML index");
    });
  });

  test("--no-clean-urls keeps explicit extensions working", async () => {
    await withServer({ cleanUrls: false }, async server => {
      expect((await fetch(`${server.url}/page`)).status).toBe(404);
      expect((await fetch(`${server.url}/__api/page/page`)).status).toBe(404);
      expect((await fetch(`${server.url}/page.md`)).status).toBe(200);
      expect((await fetch(`${server.url}/__api/page/page.md`)).status).toBe(200);
    });
  });

  test("--single falls back to index.md but clean URLs still win", async () => {
    await withServer({ single: true }, async server => {
      const shell = await fetch(`${server.url}/app/deep/link`);
      expect(shell.status).toBe(200);

      const fallback = await api<DocumentPayload>(`${server.url}/__api/page/app/deep/link`);
      expect(fallback.kind).toBe("document");
      expect(fallback.title).toBe("Home");

      const clean = await api<DocumentPayload>(`${server.url}/__api/page/page`);
      expect(clean.title).toBe("Page");
    });
  });

  test("--theme is reflected in the shell config", async () => {
    await withServer({ theme: "dark" }, async server => {
      const html = await (await fetch(`${server.url}/page.md`)).text();
      expect(shellConfig(html).theme).toBe("dark");
    });
  });

  test("--highlight renders shiki output", async () => {
    await withServer({ highlight: true }, async server => {
      const payload = await api<DocumentPayload>(`${server.url}/__api/page/code.md`);
      expect(payload.html).toContain('class="shiki');
    });
  });

  test("--html off removes raw HTML from the page payload", async () => {
    await withServer({ html: "off" }, async server => {
      const payload = await api<DocumentPayload>(`${server.url}/__api/page/unsafe.md`);
      expect(payload.html).not.toContain("<script>");
      expect(payload.html).toContain("Safe");
    });
  });

  test("--single can fall back to a user index.html", async () => {
    const htmlFixture = await createServerFixture("serve-md-single-html-");

    try {
      await htmlFixture.seed("index.html", "<!doctype html><html><body><h1>SPA</h1></body></html>");

      const server = await startServer({
        root: htmlFixture.root,
        port: 0,
        hostname: "127.0.0.1",
        highlight: false,
        live: false,
        single: true,
        webRoot: htmlFixture.webRoot,
      });

      try {
        const response = await fetch(`${server.url}/deep/link`);
        expect(response.status).toBe(200);

        const html = await response.text();
        expect(html).toContain("<h1>SPA</h1>");
        expect(html).not.toContain('id="app"');
      } finally {
        server.close();
      }
    } finally {
      await htmlFixture.cleanup();
    }
  });
});

describe("missing web build", () => {
  test("returns a helpful 503 shell but keeps the API available", async () => {
    const emptyWebRoot = await mkdtemp(join(tmpdir(), "serve-md-empty-web-"));

    const server = await startServer({
      root: fixture.root,
      port: 0,
      hostname: "127.0.0.1",
      highlight: false,
      live: false,
      webRoot: emptyWebRoot,
    });

    try {
      const shell = await fetch(`${server.url}/page.md`);
      expect(shell.status).toBe(503);
      expect(await shell.text()).toContain("bun run build");

      const payload = await api<DocumentPayload>(`${server.url}/__api/page/page.md`);
      expect(payload.title).toBe("Page");
    } finally {
      server.close();
      await rm(emptyWebRoot, { recursive: true, force: true });
    }
  });
});
