/** Constants used by the Bun server. Protocol paths live in `shared/constants.ts`. */

/** Fenced code language rendered in the browser by Mermaid. */
export const MERMAID_LANGUAGE = "mermaid";

/** Directories that are never watched, listed, or served implicitly. */
export const IGNORED_NAMES = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  ".cache",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".venv",
  "__pycache__",
]);

export const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mdown", ".mkd"]);

export const MARKDOWN_EXTENSION_RE = /\.(md|markdown|mdown|mkd)$/i;

export const WATCHED_EXTENSIONS = /\.(md|markdown|mdown|mkd|html?|css)$/i;

export const MAX_CACHED_DOCUMENTS = 64;

export const MAX_HTML_INJECTION_BYTES = 5 * 1024 * 1024;

export const WATCH_DEBOUNCE_MS = 80;

/** Suffixes tried when resolving extensionless (clean) URLs, in order. */
export const CLEAN_URL_SUFFIXES = [".md", ".markdown", ".html", ".htm"] as const;
