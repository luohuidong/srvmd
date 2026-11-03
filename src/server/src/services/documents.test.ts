import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import timers from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { RenderedDocument, Renderer } from "../markdown/render.js";
import { createDocumentStore } from "./documents.js";

let directory: string;

beforeEach(async () => {
  directory = await fsp.mkdtemp(path.join(os.tmpdir(), "srvmd-documents-"));
});

afterEach(async () => {
  await fsp.rm(directory, { recursive: true, force: true });
});

function rendered(value: string): RenderedDocument {
  return {
    html: `<p>${value}</p>`,
    toc: [],
    title: value,
    mermaid: [],
  };
}

async function waitFor(
  condition: () => boolean,
  timeout = 1000,
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout)
      throw new Error("Timed out waiting for condition");
    await timers.setTimeout(5);
  }
}

describe("DocumentStore", () => {
  test("shares one render between concurrent requests and invalidates by path", async () => {
    const file = path.join(directory, "doc.md");
    await fsp.writeFile(file, "before");

    let calls = 0;
    const renderer: Renderer = {
      async render(source) {
        calls++;
        return rendered(source);
      },
    };
    const store = createDocumentStore(renderer);

    const [first, second] = await Promise.all([
      store.get(file),
      store.get(file),
    ]);
    expect(calls).toBe(1);
    expect(first).toBe(second);

    await store.get(file);
    expect(calls).toBe(1);

    store.invalidate([path.join(directory, "other.md")]);
    await store.get(file);
    expect(calls).toBe(1);

    store.invalidate([file]);
    await store.get(file);
    expect(calls).toBe(2);
  });

  test("renders the latest source after an invalidation during rendering", async () => {
    const file = path.join(directory, "doc.md");
    await fsp.writeFile(file, "before");

    const pending: Array<{
      resolve: (document: RenderedDocument) => void;
      source: string;
    }> = [];
    let calls = 0;
    const renderer: Renderer = {
      render(source) {
        calls++;
        return new Promise(resolve => pending.push({ resolve, source }));
      },
    };
    const store = createDocumentStore(renderer);

    const first = store.get(file);
    await waitFor(() => pending.length === 1);

    store.invalidate([file]);
    const second = store.get(file);
    await timers.setTimeout(10);
    expect(calls).toBe(1);

    pending[0]?.resolve(rendered("first"));
    await waitFor(() => pending.length === 2);

    pending[1]?.resolve(rendered("second"));
    await expect(first).resolves.toMatchObject({
      document: { html: "<p>second</p>" },
    });
    await expect(second).resolves.toMatchObject({
      document: { html: "<p>second</p>" },
    });

    await store.get(file);
    expect(calls).toBe(2);
  });

  test("resolves null when the file does not exist", async () => {
    let calls = 0;
    const store = createDocumentStore({
      async render(source) {
        calls++;
        return rendered(source);
      },
    });

    await expect(
      store.get(path.join(directory, "gone.md")),
    ).resolves.toBeNull();
    expect(calls).toBe(0);
  });

  test("drops the cache and recovers when the file is deleted and recreated", async () => {
    const file = path.join(directory, "doc.md");
    await fsp.writeFile(file, "before");

    let calls = 0;
    const store = createDocumentStore({
      async render(source) {
        calls++;
        return rendered(source);
      },
    });

    await expect(store.get(file)).resolves.toMatchObject({
      document: { html: "<p>before</p>" },
    });

    await fsp.rm(file);
    await expect(store.get(file)).resolves.toBeNull();

    await fsp.writeFile(file, "after");
    await expect(store.get(file)).resolves.toMatchObject({
      document: { html: "<p>after</p>" },
    });
    expect(calls).toBe(2);
  });
});
