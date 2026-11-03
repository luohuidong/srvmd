import http from "node:http";
import stream from "node:stream";
import { WebSocketServer } from "ws";
import { constants } from "../../shared/src/index.js";
import { resolveConfig, type ServerOptions } from "./config.js";
import { createContext, type ServerContext } from "./context.js";
import { textResponse } from "./http/respond.js";
import { createRequestHandler } from "./routes/index.js";

type RunningServer = {
  port: number;
  url: string;
  /** Absolute path of the served directory, with symlinks resolved. */
  root: string;
  close(): void;
};

/** Convert a Node HTTP request into the Fetch request the routes consume. */
function toRequest(request: http.IncomingMessage): Request {
  const host = request.headers.host ?? "localhost";
  const url = new URL(request.url ?? "/", `http://${host}`);
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }

  return new Request(url, { method: request.method ?? "GET", headers });
}

/** Write a Fetch response to the Node server response, preserving streaming. */
function writeResponse(
  response: http.ServerResponse,
  method: string,
  result: Response,
): void {
  response.statusCode = result.status;
  result.headers.forEach((value, name) => {
    response.setHeader(name, value);
  });

  if (method.toUpperCase() === "HEAD" || result.body === null) {
    if (result.body) void result.body.cancel().catch(() => {});
    response.end();
    return;
  }

  const body = stream.Readable.fromWeb(
    result.body as import("node:stream/web").ReadableStream<Uint8Array>,
  );
  response.on("close", () => body.destroy());
  body.on("error", () => response.destroy());
  body.pipe(response);
}

function createRequestListener(
  handler: (request: Request) => Promise<Response>,
): http.RequestListener {
  return (request, response) => {
    void (async () => {
      const method = request.method ?? "GET";
      try {
        const result = await handler(toRequest(request));
        writeResponse(response, method, result);
      } catch (cause) {
        console.error("[srvmd]", cause);
        if (response.headersSent) {
          response.destroy();
          return;
        }
        const message = cause instanceof Error ? cause.message : String(cause);
        writeResponse(response, method, textResponse(message, 500, method));
      }
    })();
  };
}

/** Attach the live-reload WebSocket server to the HTTP upgrade event. */
function attachWebSocketServer(
  server: http.Server,
  live: ServerContext["live"],
): WebSocketServer {
  const sockets = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    let pathname: string;
    try {
      pathname = new URL(
        request.url ?? "/",
        `http://${request.headers.host ?? "localhost"}`,
      ).pathname;
    } catch {
      socket.destroy();
      return;
    }

    if (pathname !== constants.LIVE_PATH) {
      socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      return;
    }

    sockets.handleUpgrade(request, socket, head, connection => {
      sockets.emit("connection", connection, request);
    });
  });

  sockets.on("connection", connection => {
    live.open(connection);
    connection.on("close", () => live.close(connection));
    connection.on("error", () => live.close(connection));
    connection.on("message", message => live.message(connection, message));
  });
  sockets.on("error", cause => console.error("[srvmd]", cause));

  return sockets;
}

export async function startServer(
  options: ServerOptions,
): Promise<RunningServer> {
  const config = await resolveConfig(options);
  const context = await createContext(config);
  const live = context.live;
  const server = http.createServer(
    createRequestListener(createRequestHandler(context)),
  );
  const sockets = attachWebSocketServer(server, live);
  let started = false;

  server.on("error", cause => {
    if (started) console.error("[srvmd]", cause);
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const onListenError = (cause: Error) => {
        server.off("error", onListenError);
        reject(cause);
      };

      server.once("error", onListenError);
      server.listen(config.port, "0.0.0.0", () => {
        server.off("error", onListenError);
        started = true;
        resolve();
      });
    });
  } catch (cause) {
    context.dispose();
    sockets.close();
    throw cause;
  }

  const address = server.address();
  const port =
    typeof address === "object" && address !== null
      ? address.port
      : config.port;
  let closed = false;

  return {
    port,
    root: config.root,
    url: `http://localhost:${port}`,
    close() {
      if (closed) return;
      closed = true;
      context.dispose();
      sockets.close();
      server.closeAllConnections();
      server.close();
    },
  };
}
