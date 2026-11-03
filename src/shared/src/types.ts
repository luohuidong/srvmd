/** Types shared by the Node server and the Svelte web app. Keep this file runtime-free. */

export type TocItem = {
  level: number;
  id: string;
  text: string;
};

export type Breadcrumb = {
  label: string;
  href: string;
};

/** A Mermaid diagram extracted from a Markdown document. */
export type MermaidSource = {
  id: string;
  source: string;
};

export type DirEntryKind = "dir" | "file" | "markdown";

export type DirEntry = {
  name: string;
  kind: DirEntryKind;
  size?: number;
  /** ISO 8601 timestamp. Formatting belongs to the web app. */
  mtime?: string;
};

/** A Markdown document in the same directory as the current page. */
export type SiblingDocument = {
  name: string;
  /** Absolute URL path, encoded and ready for an `href`. */
  href: string;
  active: boolean;
};
