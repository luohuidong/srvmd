import http from "node:http";
import stream from "node:stream";

export type HttpServerFixture = {
  url: URL;
  requests: string[];
  close(): void;
};

/** Minimal fetch-style server used to stand in for Vite in integration tests. */
export async function createHttpServer(
  handler: (request: Request) => Response | Promise<Response>,
): Promise<HttpServerFixture> {
  const requests: string[] = [];

  const server = http.createServer((incoming, outgoing) => {
    const host = incoming.headers.host ?? "localhost";
    const url = new URL(incoming.url ?? "/", `http://${host}`);
    requests.push(`${incoming.method ?? "GET"} ${url.pathname}${url.search}`);

    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (value === undefined) continue;
      headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }

    void Promise.resolve(
      handler(
        new Request(url, {
          method: incoming.method ?? "GET",
          headers,
        }),
      ),
    )
      .then(response => {
        outgoing.statusCode = response.status;
        response.headers.forEach((value, name) => {
          outgoing.setHeader(name, value);
        });
        if (incoming.method === "HEAD" || response.body === null) {
          if (response.body) void response.body.cancel().catch(() => {});
          outgoing.end();
          return;
        }
        const body = stream.Readable.fromWeb(
          response.body as import("node:stream/web").ReadableStream<Uint8Array>,
        );
        outgoing.on("close", () => body.destroy());
        body.on("error", () => outgoing.destroy());
        body.pipe(outgoing);
      })
      .catch(error => {
        outgoing.statusCode = 500;
        outgoing.end(error instanceof Error ? error.message : String(error));
      });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const port =
    typeof address === "object" && address !== null ? address.port : 0;

  return {
    url: new URL(`http://127.0.0.1:${port}`),
    requests,
    close() {
      server.closeAllConnections();
      server.close();
    },
  };
}
