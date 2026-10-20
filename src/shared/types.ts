/** Types shared by the Bun server and the Svelte web app. Keep this file runtime-free. */

export type Theme = "auto" | "light" | "dark";

/** The concrete theme applied to the document after "auto" has been resolved. */
export type ResolvedTheme = "light" | "dark";

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
