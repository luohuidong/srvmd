import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { contracts } from "../../../shared/src/index.js";
import { constants } from "../../../shared/src/index.js";
import { createHttpServer } from "../../test/http-fixture.js";
import {
  createServerFixture,
  type ServerFixture,
} from "../../test/server-fixture.js";
import { startServer } from "../create-server.js";

/** Must match the module the Vite build emits and `static-html.ts` injects. */
const LIVE_CLIENT_SCRIPT_PATH = `${constants.APP_ASSET_PREFIX}/live-static.js`;
const RAW_MARKDOWN = "# Page\n\noriginal\n";

let fixture: ServerFixture;
let running: Awaited<ReturnType<typeof startServer>>;
let base: string;

type ReloadTrigger = () => Promise<void>;

/**
 * Open the live socket, run the trigger, and resolve the first matching event.
 * Triggering on `open` keeps the test independent of watcher startup timing.
 */
async function expectReloadEvent(
  trigger: ReloadTrigger,
  matches: (event: contracts.LiveReloadEvent) => boolean = () => true,
): Promise<contracts.LiveReloadEvent> {
  const socket = new WebSocket(
    `${base.replace(/^http/, "ws")}${constants.LIVE_PATH}`,
  );

  try {
    return await new Promise<contracts.LiveReloadEvent>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out waiting for a reload event")),
        4000,
      );
      const fail = (error: Error) => {
        clearTimeout(timer);
        reject(error);
      };

      socket.addEventListener("error", () =>
        fail(new Error("WebSocket error")),
      );
      socket.addEventListener("open", () => {
        trigger().catch(error =>
          fail(error instanceof Error ? error : new Error(String(error))),
        );
      });
      socket.addEventListener("message", event => {
        const payload = JSON.parse(
          String(event.data),
        ) as contracts.LiveReloadEvent;
        if (!matches(payload)) return;
        clearTimeout(timer);
        resolve(payload);
      });
    });
  } finally {
    socket.close();
  }
}

beforeAll(async () => {
  fixture = await createServerFixture("serve-md-routing-");

  await fixture.seed("page.md", "# Page\n\noriginal\n");
  await fixture.seed("guide/index.md", "# Guide\n\n## One\n\n## Two\n");
  await fixture.seed("sub/index.md", "# Sub Home\n");
  await fixture.seed("live.md", "# Live\n\nbefore\n");
  await fixture.seed("deep/live.md", "# Deep\n\nbefore\n");
  await fixture.seed("plain.txt", "hello static");
  await fixture.seed("data.json", '{"ok":true}');
  await fixture.seed(
    "static.html",
    "<!doctype html><html><body><h1>Static</h1></body></html>",
  );
  await fixture.seed(
    "htmlindex/index.html",
    "<!doctype html><html><body><h1>HTML index</h1></body></html>",
  );
  await fixture.seed("node_modules/pkg/index.js", "dependency");
  await fixture.seed(".hidden.md", "hidden");

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

describe("shell routes", () => {
  test("serves the shell", async () => {
    const response = await fetch(`${base}/page.md`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(Number(response.headers.get("content-length"))).toBeGreaterThan(0);

    const html = await response.text();
    expect(html).toContain(constants.SHELL_MARKER);
    expect(html).toContain('id="app"');
    expect(html).not.toContain('<h1 id="page"');
  });

  test("serves the shell for directory routes", async () => {
    const response = await fetch(`${base}/guide/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('id="app"');
  });

  test("returns a 503 when the web dev server is unavailable", async () => {
    const unavailable = await createHttpServer(() => new Response("unused"));
    const devUrl = unavailable.url.origin;
    unavailable.close();

    const server = await startServer({
      root: fixture.root,
      port: 0,
      ignore: [],
      web: { kind: "dev", url: devUrl },
    });

    try {
      const response = await fetch(`${server.url}/page.md`);
      expect(response.status).toBe(503);
      expect(await response.text()).toContain(
        `web dev server is unavailable at ${new URL(devUrl).origin}`,
      );
    } finally {
      server.close();
    }
  });

  test("serves the shell from a web dev server", async () => {
    const devServer = await createHttpServer(
      () =>
        new Response(
          `<!doctype html><html><head><meta name="generator" content="srvmd" /></head><body><div id="app"></div></body></html>`,
          { headers: { "content-type": "text/html; charset=utf-8" } },
        ),
    );

    const server = await startServer({
      root: fixture.root,
      port: 0,
      ignore: [],
      web: { kind: "dev", url: devServer.url.origin },
    });

    try {
      const response = await fetch(`${server.url}/page.md`);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain(constants.SHELL_MARKER);
      expect(html).toContain('id="app"');

      const staticHtml = await (
        await fetch(`${server.url}/static.html`)
      ).text();
      expect(staticHtml).toContain(
        `${constants.APP_ASSET_PREFIX}/src/live-static.ts`,
      );
    } finally {
      server.close();
      devServer.close();
    }
  });

  test("returns a 404 shell for missing pages", async () => {
    const response = await fetch(`${base}/missing`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('id="app"');
  });

  test("supports HEAD for shell routes", async () => {
    const response = await fetch(`${base}/page.md`, { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(Number(response.headers.get("content-length"))).toBeGreaterThan(0);
    expect(await response.text()).toBe("");
  });

  test("redirects directories with a trailing slash and keeps the query string", async () => {
    const response = await fetch(`${base}/sub?tab=2`, { redirect: "manual" });
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/sub/?tab=2");
  });

  test("returns a helpful 503 shell but keeps the API available", async () => {
    const emptyWebRoot = await fsp.mkdtemp(
      path.join(os.tmpdir(), "serve-md-empty-web-"),
    );

    const server = await startServer({
      root: fixture.root,
      port: 0,
      ignore: [],
      web: { kind: "dist", root: emptyWebRoot },
    });

    try {
      const shell = await fetch(`${server.url}/page.md`);
      expect(shell.status).toBe(503);
      expect(await shell.text()).toContain("web assets are missing at");

      const payload = (await (
        await fetch(`${server.url}/__api/page/page.md`)
      ).json()) as contracts.DocumentPayload;
      expect(payload.title).toBe("Page");
    } finally {
      server.close();
      await fsp.rm(emptyWebRoot, { recursive: true, force: true });
    }
  });
});

describe("static and raw responses", () => {
  test("supports ?raw", async () => {
    const response = await fetch(`${base}/page.md?raw`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(await response.text()).toBe(RAW_MARKDOWN);
  });

  test("answers HEAD for static files with the real size", async () => {
    const response = await fetch(`${base}/plain.txt`, { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("12");
    expect(await response.text()).toBe("");
  });

  test("adds the UTF-8 charset to textual file responses", async () => {
    const text = await fetch(`${base}/plain.txt`);
    expect(text.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    await text.text();

    const json = await fetch(`${base}/data.json`);
    expect(json.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    await json.text();
  });

  test("honors If-Modified-Since", async () => {
    const first = await fetch(`${base}/plain.txt`);
    const lastModified = first.headers.get("last-modified");
    expect(lastModified).not.toBeNull();
    await first.text();

    const second = await fetch(`${base}/plain.txt`, {
      headers: { "If-Modified-Since": lastModified ?? "" },
    });
    expect(second.status).toBe(304);
  });

  test("revalidates static files and serves ranges", async () => {
    const first = await fetch(`${base}/plain.txt`);
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();
    expect(await first.text()).toBe("hello static");

    const cached = await fetch(`${base}/plain.txt`, {
      headers: { "if-none-match": etag ?? "" },
    });
    expect(cached.status).toBe(304);

    const ranged = await fetch(`${base}/plain.txt`, {
      headers: { Range: "bytes=0-4" },
    });
    expect(ranged.status).toBe(206);
    expect(await ranged.text()).toBe("hello");
  });

  test("handles range edge cases and ignores unsupported ranges", async () => {
    const cases = [
      ["bytes=2-", 206, "llo static", "bytes 2-11/12"],
      ["bytes=-5", 206, "tatic", "bytes 7-11/12"],
      ["Bytes=0-4", 206, "hello", "bytes 0-4/12"],
      ["bytes=0-4,6-8", 200, "hello static", null],
      ["items=0-4", 200, "hello static", null],
      ["bytes=5-4", 200, "hello static", null],
      ["bytes=99-100", 416, "", "bytes */12"],
    ] as const;

    for (const [range, status, body, contentRange] of cases) {
      const response = await fetch(`${base}/plain.txt`, {
        headers: { Range: range },
      });
      expect(response.status).toBe(status);
      expect(await response.text()).toBe(body);
      expect(response.headers.get("content-range")).toBe(contentRange);
    }
  });

  test("honors If-Range dates and rejects weak ETags", async () => {
    const first = await fetch(`${base}/plain.txt`);
    const lastModified = first.headers.get("last-modified");
    const etag = first.headers.get("etag");
    await first.text();

    expect(lastModified).not.toBeNull();
    expect(etag).toMatch(/^"/);

    const matchingDate = await fetch(`${base}/plain.txt`, {
      headers: { Range: "bytes=0-4", "If-Range": lastModified ?? "" },
    });
    expect(matchingDate.status).toBe(206);
    expect(await matchingDate.text()).toBe("hello");

    const staleDate = await fetch(`${base}/plain.txt`, {
      headers: {
        Range: "bytes=0-4",
        "If-Range": "Thu, 01 Jan 1970 00:00:00 GMT",
      },
    });
    expect(staleDate.status).toBe(200);
    expect(await staleDate.text()).toBe("hello static");

    const strongEtag = await fetch(`${base}/plain.txt`, {
      headers: { Range: "bytes=0-4", "If-Range": etag ?? "" },
    });
    expect(strongEtag.status).toBe(206);
    expect(await strongEtag.text()).toBe("hello");

    const weakEtag = await fetch(`${base}/plain.txt`, {
      headers: { Range: "bytes=0-4", "If-Range": `W/${etag ?? ""}` },
    });
    expect(weakEtag.status).toBe(200);
    expect(await weakEtag.text()).toBe("hello static");

    const mismatchedUnsatisfiable = await fetch(`${base}/plain.txt`, {
      headers: { Range: "bytes=99-100", "If-Range": '"bogus"' },
    });
    expect(mismatchedUnsatisfiable.status).toBe(200);
    expect(await mismatchedUnsatisfiable.text()).toBe("hello static");
  });

  test("serves static HTML with the live-reload client", async () => {
    const response = await fetch(`${base}/static.html`);
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain("<h1>Static</h1>");
    expect(html).toContain(
      `<script type="module" src="${LIVE_CLIENT_SCRIPT_PATH}"></script>`,
    );
    expect(html).not.toContain(constants.LIVE_PATH);
  });

  test("serves index.html directly but uses the shell for its directory", async () => {
    const directory = await fetch(`${base}/htmlindex/`);
    expect(directory.status).toBe(200);
    expect(await directory.text()).toContain('id="app"');

    const rawHtml = await fetch(`${base}/htmlindex/index.html`);
    expect(rawHtml.status).toBe(200);
    expect(await rawHtml.text()).toContain("<h1>HTML index</h1>");
  });

  test("serves the Svelte build and the static live-reload module under /__app", async () => {
    const app = await fetch(`${base}/__app/assets/app.js`);
    expect(app.status).toBe(200);
    expect(await app.text()).toContain("console.log");

    const live = await fetch(`${base}${LIVE_CLIENT_SCRIPT_PATH}`);
    expect(live.status).toBe(200);
    expect(live.headers.get("content-type")).toContain("javascript");
  });

  test("serves the Mermaid runtime", async () => {
    const response = await fetch(`${base}${constants.MERMAID_RUNTIME_PATH}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("javascript");
  });

  test("rejects unsupported methods", async () => {
    const post = await fetch(`${base}/page.md`, { method: "POST" });
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toContain("GET");

    const options = await fetch(`${base}/page.md`, { method: "OPTIONS" });
    expect(options.status).toBe(405);
    expect(options.headers.get("allow")).toBe("GET, HEAD");
  });
});

describe("path safety", () => {
  test("does not serve hidden files", async () => {
    const response = await fetch(`${base}/.hidden.md`);
    expect(response.status).toBe(404);
  });

  test("does not serve or list ignored directories", async () => {
    const direct = await fetch(`${base}/node_modules/pkg/index.js`);
    expect(direct.status).toBe(404);

    const listing = await fetch(`${base}/__api/page/node_modules/`);
    expect(listing.status).toBe(404);
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
    for (const pathname of [
      "/%2e%2e%2f%2e%2e%2fetc%2fpasswd",
      "/__api/page/%2e%2e/%2e%2e/etc/passwd",
      "/__app/%2e%2e/package.json",
    ]) {
      const response = await fetch(`${base}${pathname}`);
      expect(response.status).not.toBe(200);
    }
  });
});

describe("live reload", () => {
  test("rejects a plain HTTP request to the live endpoint", async () => {
    const response = await fetch(`${base}${constants.LIVE_PATH}`);
    expect(response.status).toBe(426);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("broadcasts root-relative paths and invalidates the rendered page", async () => {
    const event = await expectReloadEvent(() =>
      fixture.seed("live.md", "# Live\n\nafter\n"),
    );

    expect(event.type).toBe("reload");
    expect(event.files).toContain("live.md");
    expect(event.files.every(file => !file.startsWith("/"))).toBe(true);

    const payload = (await (
      await fetch(`${base}/__api/page/live.md`)
    ).json()) as contracts.DocumentPayload;
    expect(payload.html).toContain("after");
  });

  test("broadcasts nested paths with POSIX separators", async () => {
    const event = await expectReloadEvent(
      () => fixture.seed("deep/live.md", "# Deep\n\nafter\n"),
      payload => payload.files.includes("deep/live.md"),
    );

    expect(event.files.every(file => !file.includes("\\"))).toBe(true);
  });
});
