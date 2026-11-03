/** Protocol constants shared by the server and the browser. */

/** Internal page-data endpoint. The original URL path is appended verbatim. */
export const API_PAGE_PATH = "/__api/page";

/** Built Svelte assets (Vite `base`). Kept out of user-controlled `/assets`. */
export const APP_ASSET_PREFIX = "/__app";

/** WebSocket live-reload endpoint. */
export const LIVE_PATH = "/__serve_md_live";

/** Prebuilt Mermaid browser runtime, loaded lazily. */
export const MERMAID_RUNTIME_PATH = "/__serve_md_mermaid.js";

/** Breadcrumb label for the served root. */
export const ROOT_LABEL = "Home";

/** Markdown source extensions, matched case-insensitively. */
export const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".mdown", ".mkd"];

/** Matches a path that srvmd renders as Markdown. */
export const MARKDOWN_EXTENSION_RE = new RegExp(
  `\\.(?:${MARKDOWN_EXTENSIONS.map(extension => extension.slice(1)).join("|")})$`,
  "i",
);

/** Marker that identifies srvmd's shell in dev mode (`<meta name="generator">`). */
export const SHELL_MARKER = 'name="generator" content="srvmd"';
