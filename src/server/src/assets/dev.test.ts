import { describe, expect, test } from "vitest";
import { constants } from "../../../shared/src/index.js";
import {
  createHttpServer,
  type HttpServerFixture,
} from "../../test/http-fixture.js";
import { createWebAssets } from "./index.js";

function createFakeVite(): Promise<HttpServerFixture> {
  return createHttpServer(request => {
    const url = new URL(request.url);

    if (url.pathname === `${constants.APP_ASSET_PREFIX}/`) {
      return new Response(
        `<!doctype html><html><head><meta name="generator" content="srvmd" /></head><body><div id="app"></div></body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    if (url.pathname === `${constants.APP_ASSET_PREFIX}/src/main.ts`) {
      return new Response("console.log('main');", {
        headers: { "content-type": "text/javascript; charset=utf-8" },
      });
    }

    return new Response("Not found", { status: 404 });
  });
}

function assetRequest(url: URL, method = "GET"): Request {
  return new Request(url.toString(), { method });
}

describe("createWebAssets", () => {
  test("uses the built live-static entry in dist mode", () => {
    const assets = createWebAssets({ kind: "dist", root: "/tmp/dist" });

    expect(assets.liveStaticPath).toBe(
      `${constants.APP_ASSET_PREFIX}/live-static.js`,
    );
  });

  test("reads the transformed shell from the dev server", async () => {
    const vite = await createFakeVite();

    try {
      const assets = createWebAssets({ kind: "dev", url: vite.url });

      await expect(assets.readShell()).resolves.toContain(
        constants.SHELL_MARKER,
      );
      expect(vite.requests).toContain(`GET ${constants.APP_ASSET_PREFIX}/`);
    } finally {
      vite.close();
    }
  });

  test("proxies assets and keeps their query strings", async () => {
    const vite = await createFakeVite();

    try {
      const assets = createWebAssets({ kind: "dev", url: vite.url });
      const url = new URL(
        `http://srvmd.test${constants.APP_ASSET_PREFIX}/src/main.ts?t=123`,
      );
      const response = await assets.respondAsset(url, assetRequest(url));

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-type")).toContain("javascript");
      expect(await response.text()).toBe("console.log('main');");
      expect(vite.requests).toContain(
        `GET ${constants.APP_ASSET_PREFIX}/src/main.ts?t=123`,
      );
    } finally {
      vite.close();
    }
  });

  test("uses the dev live-static source and rejects traversal", async () => {
    const vite = await createFakeVite();

    try {
      const assets = createWebAssets({ kind: "dev", url: vite.url });

      expect(assets.liveStaticPath).toBe(
        `${constants.APP_ASSET_PREFIX}/src/live-static.ts`,
      );

      const url = new URL(
        `http://srvmd.test${constants.APP_ASSET_PREFIX}/%2e%2e%2fpackage.json`,
      );
      const response = await assets.respondAsset(url, assetRequest(url));
      expect(response.status).toBe(404);
    } finally {
      vite.close();
    }
  });

  test("reports an unavailable dev server", async () => {
    const vite = await createFakeVite();
    const url = vite.url;
    vite.close();

    const assets = createWebAssets({ kind: "dev", url });
    await expect(assets.readShell()).resolves.toBeNull();

    const assetUrl = new URL(
      `http://srvmd.test${constants.APP_ASSET_PREFIX}/src/main.ts`,
    );
    const response = await assets.respondAsset(
      assetUrl,
      assetRequest(assetUrl),
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toContain("web dev server is unavailable");
  });
});
