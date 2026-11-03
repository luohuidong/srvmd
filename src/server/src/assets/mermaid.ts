import fsp from "node:fs/promises";
import url from "node:url";
import { fileResponse, textResponse } from "../http/respond.js";

let bundlePath: string | null | undefined;

/** Resolve Mermaid's prebuilt browser bundle once, from the local dependency. */
function resolveBundle(): string | null {
  if (bundlePath !== undefined) return bundlePath;
  try {
    bundlePath = url.fileURLToPath(
      import.meta.resolve("mermaid/dist/mermaid.min.js"),
    );
  } catch {
    bundlePath = null;
  }
  return bundlePath;
}

function unavailable(request: Request): Response {
  return textResponse("Mermaid bundle is unavailable", 503, request.method);
}

export async function respondMermaidRuntime(
  request: Request,
): Promise<Response> {
  const path = resolveBundle();
  if (!path) return unavailable(request);

  const stats = await fsp.stat(path).catch(() => null);
  if (!stats?.isFile()) return unavailable(request);

  const response = fileResponse(
    { path, stats },
    request,
    "text/javascript; charset=utf-8",
  );
  response.headers.set("Cache-Control", "public, max-age=3600");
  return response;
}
