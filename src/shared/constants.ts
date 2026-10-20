/** Protocol constants shared by the server and the browser. */

/** Internal page-data endpoint. The original URL path is appended verbatim. */
export const API_PAGE_PATH = "/__api/page";

/** Built Svelte assets (Vite `base`). Kept out of user-controlled `/assets`. */
export const APP_ASSET_PREFIX = "/__app";

/** WebSocket live-reload endpoint. */
export const LIVE_PATH = "/__serve_md_live";

/** Prebuilt Mermaid browser runtime, loaded lazily. */
export const MERMAID_RUNTIME_PATH = "/__serve_md_mermaid.js";

/** The shell contains this JSON string token; the server replaces it with a JSON config object. */
export const CONFIG_TOKEN = '"__SERVE_MD_CONFIG__"';

export const CONFIG_ELEMENT_ID = "serve-md-config";

export const THEME_STORAGE_KEY = "serve-md-theme";
