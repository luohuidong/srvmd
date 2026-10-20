import type { Breadcrumb, DirEntry, MermaidSource, Theme, TocItem } from "./types.ts";

/** Response of `GET /__api/page/<url path>`. */
export type DocumentPayload = {
  kind: "document";
  path: string;
  title: string;
  /** Rendered Markdown content. This is content, not a page shell. */
  html: string;
  toc: TocItem[];
  mermaid: MermaidSource[];
  breadcrumbs: Breadcrumb[];
  rawHref: string;
  warning?: string;
  lang?: string;
};

export type DirectoryPayload = {
  kind: "directory";
  path: string;
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

/** Injected into the Svelte shell so the web app does not need a second config request. */
export type AppConfig = {
  rootLabel: string;
  version: string;
  theme: Theme;
  live: boolean;
  mermaid: boolean;
};
