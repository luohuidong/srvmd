import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createServerFixture, type ServerFixture } from "../../../test/server-fixture.ts";
import type { ApiErrorPayload, DirectoryPayload, DocumentPayload } from "../../shared/contracts.ts";
import { type RunningServer, startServer } from "../create-server.ts";
import { LIVE_CLIENT_SCRIPT_PATH } from "../services/live/client-script.ts";

let fixture: ServerFixture;
let running: RunningServer;
let base: string;

async function document(path: string): Promise<DocumentPayload> {
  const response = await fetch(`${base}/__api/page${path}`);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(response.headers.get("cache-control")).toBe("no-store");
  return (await response.json()) as DocumentPayload;
}

beforeAll(async () => {
  fixture = await createServerFixture("serve-md-page-");

  await fixture.seed("index.md", "# Home\n");
  await fixture.seed("page.md", "# Page\n\noriginal\n");
  await fixture.seed("etag.md", "# Etag\n\nbefore\n");
  await fixture.seed("etag-other.md", "# Other\n");
  await fixture.seed("etag-config.md", "# Config\n");
  await fixture.seed("deep/live.md", "# Deep\n\nbefore\n");
  await fixture.seed("diagram.md", "# Diagram\n\n```mermaid\ngraph TD\n  A --> B\n```\n");
  await fixture.seed("live.md", "# Live\n\nbefore\n");
  await fixture.seed("guide/index.md", "# Guide\n\n## One\n\n## Two\n");
  await fixture.seed("listing/a.txt", "a");
  await fixture.seed("plain.txt", "hello static");
  await fixture.seed("static.html", "<!doctype html><html><body><h1>Static</h1></body></html>");

  running = await startServer({
    root: fixture.root,
    port: 0,
    hostname: "127.0.0.1",
    highlight: false,
    cors: true,
    webRoot: fixture.webRoot,
  });
  base = running.url;
});

afterAll(async () => {
  running?.close();
  await fixture?.cleanup();
});

describe("Svelte shell", () => {
  test("serves the shell for markdown routes", async () => {
    const response = await fetch(`${base}/page.md`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");

    const html = await response.text();
    expect(html).toContain('id="app"');
    expect(html).toContain('id="serve-md-config"');
    expect(html).toContain('"live":true');
    expect(html).not.toContain('<h1 id="page"');
  });

  test("serves the shell for directory routes", async () => {
    const response = await fetch(`${base}/guide/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('id="app"');
  });

  test("redirects a directory without a trailing slash", async () => {
    const response = await fetch(`${base}/guide`, { redirect: "manual" });
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/guide/");
  });

  test("returns a 404 shell for missing pages", async () => {
    const response = await fetch(`${base}/missing`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('id="app"');
  });

  test("supports HEAD", async () => {
    const response = await fetch(`${base}/page.md`, { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(Number(response.headers.get("content-length"))).toBeGreaterThan(0);
    expect(await response.text()).toBe("");
  });
});

describe("page API", () => {
  test("returns structured document data", async () => {
    const payload = await document("/page.md");
    expect(payload.kind).toBe("document");
    expect(payload.title).toBe("Page");
    expect(payload.html).toContain('<h1 id="page"');
    expect(payload.html).toContain("original");
    expect(payload.rawHref).toBe("/page.md?raw");
    expect(payload.breadcrumbs).toEqual([{ label: expect.any(String), href: "/" }]);
  });

  test("resolves clean URLs", async () => {
    const payload = await document("/page");
    expect(payload.kind).toBe("document");
    expect(payload.title).toBe("Page");
  });

  test("answers conditional document requests with 304", async () => {
    const first = await fetch(`${base}/__api/page/etag.md`);
    expect(first.status).toBe(200);

    const etag = first.headers.get("etag");
    expect(etag).toMatch(/^W\//);

    const cached = await fetch(`${base}/__api/page/etag.md`, {
      headers: { "if-none-match": etag ?? "" },
    });
    expect(cached.status).toBe(304);
    expect(cached.headers.get("etag")).toBe(etag);
    expect(cached.headers.get("access-control-allow-origin")).toBe("*");
    expect(await cached.text()).toBe("");
  });

  test("answers HEAD conditional requests with 304", async () => {
    const first = await fetch(`${base}/__api/page/etag-other.md`);
    const etag = first.headers.get("etag") ?? "";

    const cached = await fetch(`${base}/__api/page/etag-other.md`, {
      method: "HEAD",
      headers: { "if-none-match": etag },
    });
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe("");
  });

  test("does not accept another document's ETag", async () => {
    const first = await fetch(`${base}/__api/page/etag-other.md`);
    const etag = first.headers.get("etag") ?? "";

    const response = await fetch(`${base}/__api/page/page.md`, {
      headers: { "if-none-match": etag },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).not.toBe(etag);
  });

  test("changes the ETag after a document edit", async () => {
    const first = await fetch(`${base}/__api/page/etag.md`);
    const etag = first.headers.get("etag");

    await fixture.seed("etag.md", "# Etag\n\nafter\n");

    const second = await fetch(`${base}/__api/page/etag.md`, {
      headers: { "if-none-match": etag ?? "" },
    });
    expect(second.status).toBe(200);
    expect(second.headers.get("etag")).not.toBe(etag);

    const payload = (await second.json()) as DocumentPayload;
    expect(payload.html).toContain("after");
  });

  test("changes the ETag when rendering options change", async () => {
    const first = await fetch(`${base}/__api/page/etag-config.md`);
    const etag = first.headers.get("etag") ?? "";

    const other = await startServer({
      root: fixture.root,
      port: 0,
      hostname: "127.0.0.1",
      highlight: false,
      mermaid: false,
      webRoot: fixture.webRoot,
    });

    try {
      const second = await fetch(`${other.url}/__api/page/etag-config.md`, {
        headers: { "if-none-match": etag },
      });
      expect(second.status).toBe(200);
      expect(second.headers.get("etag")).not.toBe(etag);
    } finally {
      other.close();
    }
  });

  test("answers conditional directory requests with 304", async () => {
    const first = await fetch(`${base}/__api/page/listing/`);
    expect(first.status).toBe(200);

    const etag = first.headers.get("etag");
    expect(etag).toMatch(/^W\//);

    const cached = await fetch(`${base}/__api/page/listing/`, {
      headers: { "if-none-match": etag ?? "" },
    });
    expect(cached.status).toBe(304);
  });

  test("extracts Mermaid sources and emits slots", async () => {
    const payload = await document("/diagram.md");
    expect(payload.mermaid).toHaveLength(1);
    expect(payload.mermaid[0]?.id).toBe("mermaid-1");
    expect(payload.mermaid[0]?.source).toContain("graph TD");
    expect(payload.html).toContain('data-mermaid-slot="mermaid-1"');
    expect(payload.html).not.toContain("mermaid-figure");
  });

  test("returns directory entries", async () => {
    const response = await fetch(`${base}/__api/page/listing/`);
    expect(response.status).toBe(200);

    const payload = (await response.json()) as DirectoryPayload;
    expect(payload.kind).toBe("directory");
    expect(payload.heading).toBe("Index of /listing/");
    expect(payload.parentHref).toBe("../");
    expect(payload.entries.map(entry => entry.name)).toEqual(["a.txt"]);
    expect(payload.entries[0]?.kind).toBe("file");
    expect(payload.entries[0]?.mtime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("returns JSON errors", async () => {
    const response = await fetch(`${base}/__api/page/missing`);
    expect(response.status).toBe(404);

    const payload = (await response.json()) as ApiErrorPayload;
    expect(payload.error.status).toBe(404);
    expect(payload.error.message.length).toBeGreaterThan(0);
  });

  test("does not serve traversal paths through the page API", async () => {
    const response = await fetch(`${base}/__api/page/%2e%2e/%2e%2e/etc/passwd`);
    expect(response.status).not.toBe(200);
  });
});

describe("non-page responses", () => {
  test("serves raw markdown", async () => {
    const response = await fetch(`${base}/page.md?raw`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(await response.text()).toBe("# Page\n\noriginal\n");
  });

  test("serves static files directly", async () => {
    const response = await fetch(`${base}/plain.txt`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("hello static");
  });

  test("supports ETag revalidation and Range requests", async () => {
    const first = await fetch(`${base}/plain.txt`);
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();

    const cached = await fetch(`${base}/plain.txt`, { headers: { "if-none-match": etag ?? "" } });
    expect(cached.status).toBe(304);

    const ranged = await fetch(`${base}/plain.txt`, { headers: { Range: "bytes=0-4" } });
    expect(ranged.status).toBe(206);
    expect(await ranged.text()).toBe("hello");
  });

  test("answers CORS preflight and adds CORS headers", async () => {
    const preflight = await fetch(`${base}/page.md`, { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");

    const response = await fetch(`${base}/plain.txt`);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");

    const shell = await fetch(`${base}/page.md`);
    expect(shell.headers.get("access-control-allow-origin")).toBe("*");

    const api = await fetch(`${base}/__api/page/page.md`);
    expect(api.headers.get("access-control-allow-origin")).toBe("*");
  });

  test("serves static HTML with the live-reload client", async () => {
    const response = await fetch(`${base}/static.html`);
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain("<h1>Static</h1>");
    expect(html).toContain(`<script type="module" src="${LIVE_CLIENT_SCRIPT_PATH}"></script>`);
    expect(html).not.toContain("__serve_md_live");
  });

  test("serves the Svelte build under /__app", async () => {
    const response = await fetch(`${base}/__app/assets/app.js`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("console.log");
  });

  test("serves the static live-reload module under /__app", async () => {
    const response = await fetch(`${base}/__app/live-static.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("javascript");
  });

  test("serves the Mermaid runtime", async () => {
    const response = await fetch(`${base}/__serve_md_mermaid.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("javascript");
  });

  test("broadcasts live reload events over the new WebSocket route", async () => {
    const socket = new WebSocket(`${base.replace(/^http/, "ws")}/__serve_md_live`);

    try {
      const payload = await new Promise<{ type: string; files: string[] }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out waiting for a reload event")), 4000);

        socket.addEventListener("error", () => {
          clearTimeout(timer);
          reject(new Error("WebSocket error"));
        });

        socket.addEventListener("open", () => {
          void fixture.seed("live.md", "# Live\n\nafter\n");
        });

        socket.addEventListener("message", event => {
          clearTimeout(timer);
          resolve(JSON.parse(String(event.data)) as { type: string; files: string[] });
        });
      });

      expect(payload.type).toBe("reload");
      expect(payload.files).toContain("live.md");
      expect(payload.files.every(file => !file.startsWith("/"))).toBe(true);

      const updated = await document("/live.md");
      expect(updated.html).toContain("after");
    } finally {
      socket.close();
    }
  });

  test("broadcasts nested paths with POSIX separators", async () => {
    const socket = new WebSocket(`${base.replace(/^http/, "ws")}/__serve_md_live`);

    try {
      const payload = await new Promise<{ type: string; files: string[] }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out waiting for a reload event")), 4000);

        socket.addEventListener("error", () => {
          clearTimeout(timer);
          reject(new Error("WebSocket error"));
        });

        socket.addEventListener("open", () => {
          void fixture.seed("deep/live.md", "# Deep\n\nafter\n");
        });

        socket.addEventListener("message", event => {
          const parsed = JSON.parse(String(event.data)) as { type: string; files: string[] };
          if (!parsed.files.includes("deep/live.md")) return;
          clearTimeout(timer);
          resolve(parsed);
        });
      });

      expect(payload.files.every(file => !file.includes("\\"))).toBe(true);
    } finally {
      socket.close();
    }
  });

  test("does not serve traversal paths under /__app", async () => {
    const response = await fetch(`${base}/__app/%2e%2e/package.json`);
    expect(response.status).not.toBe(200);
  });
});
