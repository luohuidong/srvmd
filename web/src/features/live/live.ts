import { CLEAN_URL_SUFFIXES, LIVE_PATH } from "@shared/constants.ts";
import type { LiveReloadEvent, PagePayload } from "@shared/contracts.ts";

export type LiveEvent = LiveReloadEvent;

/** Payload kind of the page on screen, or null while it is not loaded yet. */
export type PageKind = PagePayload["kind"] | null;

const STYLESHEET_RE = /\.css$/i;
const INDEX_NAMES = ["index.md", "index.html"] as const;

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Strip leading/trailing slashes and fold case, mirroring a case-insensitive filesystem. */
function normalizePath(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
}

/** Same rule the resolver uses: a non-empty extension disables clean URLs. */
function hasFileExtension(path: string): boolean {
  return path.slice(path.lastIndexOf("/") + 1).includes(".");
}

/** A stylesheet can be linked from raw HTML on any page, so it always reloads. */
export function isStylesheet(path: string): boolean {
  return STYLESHEET_RE.test(path);
}

/**
 * Whether a root-relative change can affect `pathname`.
 *
 * `kind` is the payload kind currently on screen. A directory page (and an
 * unknown page on a directory URL) is affected by anything below the URL; a
 * document page such as `/guide/` served from `guide/index.md` is not, so it
 * only reacts to its own source. Pass null while the page is still loading.
 */
export function isPageAffected(pathname: string, files: string[], kind: PageKind = null): boolean {
  if (files.length === 0) return true;

  const decoded = decodePath(pathname);
  const current = normalizePath(decoded);
  const directoryUrl = decoded === "" || decoded.endsWith("/");
  const directoryPage = kind === "directory" || (kind === null && directoryUrl);
  const indexFiles: readonly string[] = current === "" ? INDEX_NAMES : INDEX_NAMES.map(name => `${current}/${name}`);

  for (const raw of files) {
    const file = normalizePath(decodePath(raw));
    if (!file) return true;
    if (isStylesheet(file)) return true;
    if (file === current) return true;
    if (indexFiles.includes(file)) return true;

    // A document URL naming a file only matches that exact file.
    if (!hasFileExtension(current) && CLEAN_URL_SUFFIXES.some(suffix => file === `${current}${suffix}`)) {
      return true;
    }

    if (directoryPage) {
      const prefix = current === "" ? "" : `${current}/`;
      if (prefix === "" || file.startsWith(prefix)) return true;
    }
  }

  return false;
}

/** Connect to the live-reload hub and reconnect with backoff. */
export function connectLive(onEvent: (event: LiveEvent) => void): () => void {
  let closed = false;
  let socket: WebSocket | null = null;
  let retry = 500;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function connect(): void {
    if (closed) return;

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${location.host}${LIVE_PATH}`);

    socket.onopen = () => {
      retry = 500;
    };

    socket.onmessage = event => {
      try {
        const payload = JSON.parse(String(event.data)) as LiveEvent;
        if (payload.type === "reload") onEvent(payload);
      } catch {
        // Ignore malformed messages.
      }
    };

    socket.onclose = () => {
      socket = null;
      if (closed) return;
      retry = Math.min(retry * 2, 5000);
      timer = setTimeout(connect, retry);
    };

    socket.onerror = () => {
      socket?.close();
    };
  }

  connect();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    socket?.close();
  };
}
