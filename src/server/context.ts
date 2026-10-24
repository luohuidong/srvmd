import type { Highlighter } from "shiki";
import type { ResolvedConfig } from "./config.ts";
import { isMarkdownFile } from "./file-kinds.ts";
import { createHighlighterService, createRenderer, type Renderer } from "./markdown/index.ts";
import { createDocumentStore, type DocumentStore } from "./services/documents.ts";
import { createLiveReload, type LiveReload } from "./services/live/index.ts";

export type ServerContext = {
  config: ResolvedConfig;
  renderer: Renderer;
  documents: DocumentStore;
  highlighter: Highlighter | null;
  live: LiveReload | null;
};

/** Build the long-lived services a server needs (highlighter, cache, watcher). */
export async function createContext(config: ResolvedConfig): Promise<ServerContext> {
  const highlighter = config.highlight ? await createHighlighterService() : null;
  const renderer = createRenderer({
    highlighter,
    html: config.html,
    math: config.math,
    mermaid: config.mermaid,
  });
  const documents = createDocumentStore(renderer);

  const live = config.live
    ? await createLiveReload({
        root: config.root,
        ignore: config.ignore,
        // Directory and stylesheet events never enter the document cache.
        onChange: files => documents.invalidate(files.filter(isMarkdownFile)),
      })
    : null;

  return { config, renderer, documents, highlighter, live };
}

export function disposeContext(context: ServerContext): void {
  context.live?.closeAll();
  context.highlighter?.dispose();
}
