import { stat } from "node:fs/promises";
import { MAX_CACHED_DOCUMENTS } from "../constants.ts";
import type { RenderedDocument, Renderer } from "../markdown/render.ts";

type CachedDocument = {
  mtimeMs: number;
  size: number;
  document: RenderedDocument;
};

export type DocumentStore = {
  get(path: string): Promise<RenderedDocument>;
  clear(): void;
};

/** Read + render Markdown, cached by (mtime, size) and invalidated by the watcher. */
export function createDocumentStore(renderer: Renderer): DocumentStore {
  const cache = new Map<string, CachedDocument>();

  return {
    async get(path) {
      const info = await stat(path);
      const cached = cache.get(path);
      if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
        return cached.document;
      }

      const source = await Bun.file(path).text();
      const document = await renderer.render(source);
      cache.set(path, { mtimeMs: info.mtimeMs, size: info.size, document });

      if (cache.size > MAX_CACHED_DOCUMENTS) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }

      return document;
    },
    clear() {
      cache.clear();
    },
  };
}
