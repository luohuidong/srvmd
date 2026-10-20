import { LIVE_PATH } from "@shared/constants.ts";

export type LiveEvent = {
  type: "reload";
  files: string[];
};

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
