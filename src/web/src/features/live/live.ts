import type { contracts } from "@shared";
import { constants } from "@shared";

export type LiveEvent = contracts.LiveReloadEvent;

const STYLESHEET_RE = /\.css$/i;

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

function directoryOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

/** A stylesheet can be linked from raw HTML on any page, so it always reloads. */
export function isStylesheet(path: string): boolean {
  return STYLESHEET_RE.test(path);
}

/**
 * Whether a root-relative change can affect `pathname`.
 *
 * Directory URLs react to anything below them; document URLs react to their
 * exact source file and to Markdown files in the same directory, because those
 * feed the sibling navigation. Pass an empty change set to force a refresh.
 */
export function isPageAffected(pathname: string, files: string[]): boolean {
  if (files.length === 0) return true;

  const decoded = decodePath(pathname);
  const current = normalizePath(decoded);
  const currentDirectory = directoryOf(current);
  const directoryUrl = decoded === "" || decoded.endsWith("/");

  for (const raw of files) {
    const file = normalizePath(decodePath(raw));
    if (!file) return true;
    if (isStylesheet(file)) return true;
    if (file === current) return true;
    if (directoryUrl && (current === "" || file.startsWith(`${current}/`)))
      return true;
    if (
      !directoryUrl &&
      constants.MARKDOWN_EXTENSION_RE.test(file) &&
      directoryOf(file) === currentDirectory
    )
      return true;
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
    socket = new WebSocket(
      `${protocol}//${location.host}${constants.LIVE_PATH}`,
    );

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
