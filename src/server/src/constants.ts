import { constants } from "../../shared/src/index.js";

/** Constants used by the server. Shared protocol and extension constants live in `shared/constants.ts`. */

/** Fenced code language rendered in the browser by Mermaid. */
export const MERMAID_LANGUAGE = "mermaid";

/** Names never watched, listed, or served. Matched per path segment relative to the served root. */
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

const MARKDOWN_ALTERNATION = constants.MARKDOWN_EXTENSIONS.map(extension =>
  extension.slice(1),
).join("|");

export const MARKDOWN_EXTENSION_RE = constants.MARKDOWN_EXTENSION_RE;

export const WATCHED_EXTENSIONS = new RegExp(
  `\\.(?:${MARKDOWN_ALTERNATION}|html?|css)$`,
  "i",
);

export const MAX_CACHED_DOCUMENTS = 64;

export const MAX_HTML_INJECTION_BYTES = 5 * 1024 * 1024;

export const WATCH_DEBOUNCE_MS = 80;

/** Upper bound for a write burst; without it a resetting debounce never fires. */
export const WATCH_MAX_WAIT_MS = 250;
