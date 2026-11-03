import type {
  Breadcrumb,
  DirEntry,
  MermaidSource,
  SiblingDocument,
  TocItem,
} from "./types.js";

/** Response of `GET /__api/page/<url path>`. */
export type DocumentPayload = {
  kind: "document";
  title: string;
  /** Rendered Markdown content. This is content, not a page shell. */
  html: string;
  toc: TocItem[];
  /** Markdown documents in the same directory, including the current page. */
  siblings: SiblingDocument[];
  mermaid: MermaidSource[];
  breadcrumbs: Breadcrumb[];
  rawHref: string;
  warning?: string;
  lang?: string;
};

export type DirectoryPayload = {
  kind: "directory";
  heading: string;
  parentHref?: string;
  entries: DirEntry[];
  breadcrumbs: Breadcrumb[];
};

/** A page that the server wants the browser to visit at another URL. */
export type RedirectPayload = {
  kind: "redirect";
  location: string;
};

export type PagePayload = DocumentPayload | DirectoryPayload | RedirectPayload;

export type ApiErrorPayload = {
  error: {
    status: number;
    message: string;
  };
};

/** WebSocket live-reload event. Paths are files or directories relative to the served root (POSIX separators). */
export type LiveReloadEvent = {
  type: "reload";
  files: string[];
};
