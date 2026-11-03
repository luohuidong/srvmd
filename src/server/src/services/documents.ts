import crypto from "node:crypto";
import type fs from "node:fs";
import fsp from "node:fs/promises";
import { MAX_CACHED_DOCUMENTS } from "../constants.js";
import type { RenderedDocument, Renderer } from "../markdown/index.js";

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
  promise: Promise<RenderedDocumentResult | null>;
};

type RenderedDocumentResult = {
  entry: DocumentEntry;
  /** A watcher event arrived during the render, so the result may be stale. */
  stale: boolean;
};

export type DocumentStore = {
  /** Resolves null when the file is gone, so a delete during a request becomes a 404. */
  get(path: string): Promise<DocumentEntry | null>;
  invalidate(paths: readonly string[]): void;
};

/** Bound retries so a request cannot follow an endless edit stream forever. */
const MAX_RENDER_ATTEMPTS = 2;

function revisionOf(source: string): string {
  return `${source.length.toString(36)}-${crypto.createHash("sha1").update(source).digest("hex")}`;
}

/**
 * Read + render Markdown, cached by `(mtime, size)` and invalidated by path.
 *
 * Concurrent requests for the same path share one render. If a watcher event
 * arrives while that render is running, the result is not cached and the next
 * request renders the latest source. A request retries once so the client that
 * triggered the invalidation does not receive the stale render.
 *
 * A file that disappears between resolution and rendering resolves null, so the
 * route layer can answer 404 instead of leaking a 500.
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

  function start(
    path: string,
    mtimeMs: number,
    size: number,
    generation: number,
  ): Promise<RenderedDocumentResult | null> {
    const promise = (async () => {
      const source = await readSourceOrNull(path);
      if (source === null) return null;

      const document = await renderer.render(source);
      const entry: DocumentEntry = { document, revision: revisionOf(source) };
      const stale = (generations.get(path) ?? 0) !== generation;

      if (!stale) {
        cache.set(path, { mtimeMs, size, entry });
        // A fresh render means no older generation is still in play.
        generations.delete(path);
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
        const info = await statOrNull(path);
        if (!info) {
          cache.delete(path);
          return null;
        }

        const cached = cache.get(path);
        if (
          cached &&
          cached.mtimeMs === info.mtimeMs &&
          cached.size === info.size
        ) {
          // Refresh insertion order so the cache behaves as an LRU.
          cache.delete(path);
          cache.set(path, cached);
          return cached.entry;
        }

        const pending = inflight.get(path);
        const result = pending
          ? await pending.promise
          : await start(
              path,
              info.mtimeMs,
              info.size,
              generations.get(path) ?? 0,
            );

        if (!result) return null;
        if (!result.stale) return result.entry;
        fallback = result.entry;
      }

      if (!fallback) throw new Error(`Failed to render ${path}`);
      return fallback;
    },
    invalidate(paths) {
      for (const path of paths) {
        cache.delete(path);
        // Only a render that is already running can be superseded; without an
        // inflight render the next read starts from the fresh source anyway.
        if (inflight.has(path)) {
          generations.set(path, (generations.get(path) ?? 0) + 1);
        }
      }
    },
  };
}

/** A file that disappeared mid-request is a 404, not a server error. */
async function statOrNull(path: string): Promise<fs.Stats | null> {
  try {
    return await fsp.stat(path);
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

/** Read the source, tolerating a delete that lands between `stat` and `text`. */
async function readSourceOrNull(path: string): Promise<string | null> {
  try {
    return await fsp.readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === "ENOENT" || code === "ENOTDIR";
}
