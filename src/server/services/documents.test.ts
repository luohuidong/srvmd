import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RenderedDocument, Renderer } from "../markdown/render.ts";
import { createDocumentStore } from "./documents.ts";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "srvmd-documents-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function rendered(value: string): RenderedDocument {
  return {
    html: `<p>${value}</p>`,
    toc: [],
    title: value,
    frontmatter: {},
    mermaid: [],
    raw: value,
  };
}

async function waitFor(condition: () => boolean, timeout = 1000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error("Timed out waiting for condition");
    await Bun.sleep(5);
  }
}

describe("DocumentStore", () => {
  test("shares one render between concurrent requests and invalidates by path", async () => {
    const file = join(directory, "doc.md");
    await writeFile(file, "before");

    let calls = 0;
    const renderer: Renderer = {
      async render(source) {
        calls++;
        return rendered(source);
      },
    };
    const store = createDocumentStore(renderer);

    const [first, second] = await Promise.all([store.get(file), store.get(file)]);
    expect(calls).toBe(1);
    expect(first).toBe(second);

    await store.get(file);
    expect(calls).toBe(1);

    store.invalidate([join(directory, "other.md")]);
    await store.get(file);
    expect(calls).toBe(1);

    store.invalidate([file]);
    await store.get(file);
    expect(calls).toBe(2);
  });

  test("renders the latest source after an invalidation during rendering", async () => {
    const file = join(directory, "doc.md");
    await writeFile(file, "before");

    const pending: Array<{ resolve: (document: RenderedDocument) => void; source: string }> = [];
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
    await Bun.sleep(10);
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
});
