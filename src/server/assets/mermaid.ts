import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { baseHeaders } from "../http/headers.ts";
import { fileResponse } from "../http/respond.ts";

let bundlePath: string | null | undefined;

/** Resolve Mermaid's prebuilt browser bundle once, from the local dependency. */
function resolveBundle(): string | null {
  if (bundlePath !== undefined) return bundlePath;
  try {
    bundlePath = fileURLToPath(import.meta.resolve("mermaid/dist/mermaid.min.js"));
  } catch {
    bundlePath = null;
  }
  return bundlePath;
}

function unavailable(cors: boolean): Response {
  return new Response("Mermaid bundle is unavailable", { status: 503, headers: baseHeaders(cors) });
}

export async function respondMermaidRuntime(request: Request, cors: boolean): Promise<Response> {
  const path = resolveBundle();
  if (!path) return unavailable(cors);

  const stats = await stat(path).catch(() => null);
  if (!stats?.isFile()) return unavailable(cors);

  const response = fileResponse(
    { path, stats, relative: "mermaid.min.js" },
    request,
    cors,
    "text/javascript; charset=utf-8",
  );
  response.headers.set("Cache-Control", "public, max-age=3600");
  return response;
}
