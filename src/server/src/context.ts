import { createWebAssets, type WebAssets } from "./assets/index.js";
import type { ResolvedConfig } from "./config.js";
import { isMarkdownFile } from "./file-kinds.js";
import { createHighlighterService, createRenderer } from "./markdown/index.js";
import {
  createDocumentStore,
  type DocumentStore,
} from "./services/documents.js";
import { createLiveReload, type LiveHub } from "./services/live/index.js";

export type ServerContext = {
  config: ResolvedConfig;
  documents: DocumentStore;
  live: LiveHub;
  web: WebAssets;
  dispose(): void;
};

/** Build the long-lived services a server needs (highlighter, cache, watcher). */
export async function createContext(
  config: ResolvedConfig,
): Promise<ServerContext> {
  const highlighter = await createHighlighterService();
  const documents = createDocumentStore(createRenderer({ highlighter }));
  const web = createWebAssets(config.web);

  const live = await createLiveReload({
    root: config.root,
    ignore: config.ignore,
    // Directory and stylesheet events never enter the document cache.
    onChange: files => documents.invalidate(files.filter(isMarkdownFile)),
  });

  return {
    config,
    documents,
    live,
    web,
    dispose() {
      live.closeAll();
      highlighter?.dispose();
    },
  };
}
