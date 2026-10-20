import type { Server } from "bun";
import { resolveConfig, type ServeMarkdownOptions } from "./config.ts";
import { createContext, disposeContext } from "./context.ts";
import { textResponse } from "./http/respond.ts";
import { createRequestHandler } from "./routes/index.ts";

export type { ServeMarkdownOptions } from "./config.ts";

export type RunningServer = {
  server: Server<undefined>;
  port: number;
  url: string;
  root: string;
  close(): void;
};

export async function startServer(options: ServeMarkdownOptions = {}): Promise<RunningServer> {
  if (typeof Bun.markdown?.html !== "function") {
    throw new Error("Bun 1.3.8 or newer is required (Bun.markdown is unavailable). Run `bun upgrade`.");
  }

  const config = await resolveConfig(options);
  const context = await createContext(config);
  const handler = createRequestHandler(context);
  const live = context.live;

  const listenOptions = {
    port: config.port,
    hostname: config.hostname,
    development: true,
    idleTimeout: 255,
    error: (cause: Error) => {
      console.error("[serve-markdown]", cause);
      return textResponse(cause.message, 500, "GET", config.cors);
    },
  } as const;

  let server: Server<undefined>;
  if (live) {
    server = Bun.serve({
      ...listenOptions,
      fetch: handler,
      websocket: {
        open: socket => live.open(socket),
        close: socket => live.close(socket),
        message: (socket, message) => live.message(socket, message),
      },
    });
  } else {
    server = Bun.serve({
      ...listenOptions,
      fetch: async (request, bunServer) =>
        (await handler(request, bunServer)) ?? new Response("Not found", { status: 404 }),
    });
  }

  const port = server.port ?? config.port;

  return {
    server,
    port,
    root: config.root,
    url: `http://localhost:${port}`,
    close() {
      disposeContext(context);
      server.stop(true);
    },
  };
}
