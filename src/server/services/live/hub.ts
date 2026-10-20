import type { Server, ServerWebSocket } from "bun";

type Socket = ServerWebSocket<undefined>;

export type LiveHub = {
  upgrade(request: Request, server: Server<undefined>): boolean;
  open(socket: Socket): void;
  close(socket: Socket): void;
  message(socket: Socket, message: string | Buffer): void;
  broadcast(files: string[]): void;
  closeAll(): void;
};

/** Tracks connected browsers and pushes reload events. */
export function createLiveHub(): LiveHub {
  const sockets = new Set<Socket>();

  return {
    upgrade(request, server) {
      return server.upgrade(request);
    },
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
      const payload = JSON.stringify({ type: "reload", files });
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
