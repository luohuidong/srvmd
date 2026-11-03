import { constants } from "../../../shared/src/index.js";
import { textResponse } from "../http/respond.js";
import type { WebAssets } from "./types.js";

const SHELL_PATH = `${constants.APP_ASSET_PREFIX}/`;
const LIVE_STATIC_PATH = `${constants.APP_ASSET_PREFIX}/src/live-static.ts`;

/** Read the transformed shell from Vite. No caching: Vite owns the HTML. */
async function fetchShell(devUrl: URL): Promise<string | null> {
  const response = await fetch(new URL(SHELL_PATH, devUrl), {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (!response?.ok) return null;

  const html = await response.text().catch(() => null);
  // A different server on the configured port must not be treated as Vite.
  if (!html?.includes(constants.SHELL_MARKER)) return null;
  return html;
}

/**
 * Proxy a `/__app/*` request to Vite. Query strings carry module version and
 * import flags, so preserve them verbatim; Vite's module graph depends on them.
 */
async function proxyAsset(
  devUrl: URL,
  unavailableMessage: string,
  url: URL,
  request: Request,
): Promise<Response> {
  let relative: string;
  try {
    relative = decodeURIComponent(
      url.pathname.slice(constants.APP_ASSET_PREFIX.length),
    ).replace(/^\/+/, "");
  } catch {
    return textResponse("Malformed URL", 400, request.method);
  }

  if (
    !relative ||
    relative.includes("\0") ||
    relative.split("/").includes("..")
  ) {
    return textResponse("Not found", 404, request.method);
  }

  const response = await fetch(
    new URL(`${url.pathname}${url.search}`, devUrl),
    {
      method: request.method,
      headers: { accept: request.headers.get("accept") ?? "*/*" },
    },
  ).catch(() => null);

  if (!response) return textResponse(unavailableMessage, 503, request.method);

  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export function createDevWebAssets(devUrl: URL): WebAssets {
  const unavailableMessage = `srvmd: web dev server is unavailable at ${devUrl.origin}.`;

  return {
    liveStaticPath: LIVE_STATIC_PATH,
    unavailableMessage,
    readShell: () => fetchShell(devUrl),
    respondAsset: (url, request) =>
      proxyAsset(devUrl, unavailableMessage, url, request),
  };
}
