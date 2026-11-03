import fsp from "node:fs/promises";
import path from "node:path";
import { constants } from "../../../shared/src/index.js";
import { isInside } from "../fs-path.js";
import { fileResponse, textResponse } from "../http/respond.js";

/** Serve the Vite build under `/__app/*`, outside user-controlled static paths. */
export async function respondWebAsset(
  webRoot: string,
  url: URL,
  request: Request,
): Promise<Response> {
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return textResponse("Malformed URL", 400, request.method);
  }

  const relative = pathname
    .slice(constants.APP_ASSET_PREFIX.length)
    .replace(/^\/+/, "");
  if (!relative || relative.includes("\0")) {
    return textResponse("Not found", 404, request.method);
  }

  const filePath = path.resolve(webRoot, relative);
  if (!isInside(webRoot, filePath)) {
    return textResponse("Forbidden", 403, request.method);
  }

  const stats = await fsp.stat(filePath).catch(() => null);
  if (!stats?.isFile()) {
    return textResponse("Not found", 404, request.method);
  }

  const response = fileResponse({ path: filePath, stats }, request);
  response.headers.set("Cache-Control", "public, max-age=3600");
  return response;
}
