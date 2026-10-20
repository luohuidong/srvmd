import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { APP_ASSET_PREFIX } from "../../shared/constants.ts";
import { fileResponse, textResponse } from "../http/respond.ts";
import { isInside } from "../path.ts";

/** Serve the Vite build under `/__app/*`, outside user-controlled static paths. */
export async function respondWebAsset(webRoot: string, url: URL, request: Request, cors: boolean): Promise<Response> {
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return textResponse("Malformed URL", 400, request.method, cors);
  }

  const relative = pathname.slice(APP_ASSET_PREFIX.length).replace(/^\/+/, "");
  if (!relative || relative.includes("\0")) {
    return textResponse("Not found", 404, request.method, cors);
  }

  const filePath = resolve(webRoot, relative);
  if (!isInside(webRoot, filePath)) {
    return textResponse("Forbidden", 403, request.method, cors);
  }

  const stats = await stat(filePath).catch(() => null);
  if (!stats?.isFile()) {
    return textResponse("Not found", 404, request.method, cors);
  }

  const response = fileResponse({ path: filePath, stats, relative }, request, cors);
  response.headers.set("Cache-Control", "public, max-age=3600");
  return response;
}
