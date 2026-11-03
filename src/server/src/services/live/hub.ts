import type { RawData, WebSocket } from "ws";
import type { contracts } from "../../../../shared/src/index.js";

type Socket = WebSocket;

export type LiveHub = {
  open(socket: Socket): void;
  close(socket: Socket): void;
  message(socket: Socket, message: RawData): void;
  broadcast(files: string[]): void;
  closeAll(): void;
};

/** Tracks connected browsers and pushes reload events. */
export function createLiveHub(): LiveHub {
  const sockets = new Set<Socket>();

  return {
    open(socket) {
      sockets.add(socket);
    },
    close(socket) {
      sockets.delete(socket);
    },
    message() {
      // Clients are read-only; ignore inbound messages.
    },
    broadcast(files) {
      const event: contracts.LiveReloadEvent = { type: "reload", files };
      const payload = JSON.stringify(event);
      for (const socket of sockets) {
        try {
          socket.send(payload);
        } catch {
          sockets.delete(socket);
        }
      }
    },
    closeAll() {
      for (const socket of sockets) {
        try {
          socket.close(1001, "Server shutting down");
        } catch {}
      }
      sockets.clear();
    },
  };
}
