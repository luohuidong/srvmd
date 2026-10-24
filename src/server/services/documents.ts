import { stat } from "node:fs/promises";
import { MAX_CACHED_DOCUMENTS } from "../constants.ts";
import type { RenderedDocument, Renderer } from "../markdown/render.ts";

/** A rendered document plus the source revision used for HTTP validators. */
export type DocumentEntry = {
  document: RenderedDocument;
  revision: string;
};

type CachedDocument = {
  mtimeMs: number;
  size: number;
  entry: DocumentEntry;
};

type InflightDocument = {
  generation: number;
  promise: Promise<RenderedDocumentResult>;
};

type RenderedDocumentResult = {
  entry: DocumentEntry;
  /** A watcher event arrived during the render, so the result may be stale. */
  stale: boolean;
};

export type DocumentStore = {
  get(path: string): Promise<DocumentEntry>;
  invalidate(paths: readonly string[]): void;
};

/** Bound retries so a request cannot follow an endless edit stream forever. */
const MAX_RENDER_ATTEMPTS = 2;

function revisionOf(source: string): string {
  return `${source.length.toString(36)}-${Bun.hash(source).toString(36)}`;
}

/**
 * Read + render Markdown, cached by `(mtime, size)` and invalidated by path.
 *
 * Concurrent requests for the same path share one render. If a watcher event
 * arrives while that render is running, the result is not cached and the next
 * request renders the latest source. A request retries once so the client that
 * triggered the invalidation does not receive the stale render.
 */
export function createDocumentStore(renderer: Renderer): DocumentStore {
  const cache = new Map<string, CachedDocument>();
  const inflight = new Map<string, InflightDocument>();
  const generations = new Map<string, number>();

  function evict(): void {
    while (cache.size > MAX_CACHED_DOCUMENTS) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) return;
      cache.delete(oldest);
    }
  }

  function start(path: string, mtimeMs: number, size: number, generation: number): Promise<RenderedDocumentResult> {
    const promise = (async () => {
      const source = await Bun.file(path).text();
      const document = await renderer.render(source);
      const entry: DocumentEntry = { document, revision: revisionOf(source) };
      const stale = (generations.get(path) ?? 0) !== generation;

      if (!stale) {
        cache.set(path, { mtimeMs, size, entry });
        evict();
      }

      return { entry, stale };
    })();

    const next: InflightDocument = { generation, promise };
    inflight.set(path, next);
    const cleanup = () => {
      if (inflight.get(path) === next) inflight.delete(path);
    };
    void promise.then(cleanup, cleanup);

    return promise;
  }

  return {
    async get(path) {
      let fallback: DocumentEntry | undefined;

      for (let attempt = 0; attempt < MAX_RENDER_ATTEMPTS; attempt++) {
        const info = await stat(path);
        const cached = cache.get(path);
        if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
          // Refresh insertion order so the cache behaves as an LRU.
          cache.delete(path);
          cache.set(path, cached);
          return cached.entry;
        }

        const pending = inflight.get(path);
        const result = pending
          ? await pending.promise
          : await start(path, info.mtimeMs, info.size, generations.get(path) ?? 0);

        if (!result.stale) return result.entry;
        fallback = result.entry;
      }

      if (!fallback) throw new Error(`Failed to render ${path}`);
      return fallback;
    },
    invalidate(paths) {
      for (const path of paths) {
        generations.set(path, (generations.get(path) ?? 0) + 1);
        cache.delete(path);
      }
    },
  };
}
