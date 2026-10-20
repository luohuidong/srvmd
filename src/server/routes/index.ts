import type { Server } from "bun";
import { API_PAGE_PATH, APP_ASSET_PREFIX, LIVE_PATH, MERMAID_RUNTIME_PATH } from "../../shared/constants.ts";
import { respondMermaidRuntime } from "../assets/mermaid.ts";
import { respondWebAsset } from "../assets/web.ts";
import { MAX_HTML_INJECTION_BYTES } from "../constants.ts";
import type { ServerContext } from "../context.ts";
import {
  fileResponse,
  htmlResponse,
  methodNotAllowedResponse,
  preflightResponse,
  redirectResponse,
  textResponse,
} from "../http/respond.ts";
import { resolveResource } from "../resolve/resource.ts";
import { injectLiveReload } from "../services/live/index.ts";
import { respondPageApi } from "./page-api.ts";
import { respondShell } from "./shell.ts";

export type RequestHandler = (request: Request, server: Server<undefined>) => Promise<Response | undefined>;

/** Convert `/__api/page/<path>` back into the user-facing URL it describes. */
function pageUrlFromApi(url: URL): URL {
  const pageUrl = new URL(url);
  const suffix = url.pathname.slice(API_PAGE_PATH.length);
  pageUrl.pathname = suffix === "" ? "/" : suffix;
  pageUrl.search = "";
  return pageUrl;
}

/**
 * HTTP entry point:
 * live socket -> CORS preflight -> method guard -> internal routes -> resolve.
 */
export function createRequestHandler(context: ServerContext): RequestHandler {
  return async (request, server) => {
    const url = new URL(request.url);

    if (url.pathname === LIVE_PATH) {
      if (!context.live?.upgrade(request, server)) {
        return new Response("WebSocket upgrade required", { status: 426 });
      }
      return undefined;
    }

    const method = request.method.toUpperCase();
    if (context.config.cors && method === "OPTIONS") return preflightResponse(true);
    if (method !== "GET" && method !== "HEAD") return methodNotAllowedResponse(context.config.cors);

    if (url.pathname === MERMAID_RUNTIME_PATH && context.config.mermaid) {
      return respondMermaidRuntime(request, context.config.cors);
    }

    if (url.pathname === APP_ASSET_PREFIX || url.pathname.startsWith(`${APP_ASSET_PREFIX}/`)) {
      return respondWebAsset(context.config.webRoot, url, request, context.config.cors);
    }

    if (url.pathname === API_PAGE_PATH || url.pathname.startsWith(`${API_PAGE_PATH}/`)) {
      const pageUrl = pageUrlFromApi(url);
      const resource = await resolveResource(context.config, pageUrl);
      return respondPageApi(context, resource, request, pageUrl);
    }

    const resource = await resolveResource(context.config, url);

    if (resource.kind === "markdown" && url.searchParams.has("raw")) {
      return fileResponse(resource.file, request, context.config.cors, "text/markdown; charset=utf-8");
    }

    switch (resource.kind) {
      case "markdown":
      case "directory":
        return respondShell(context.config, 200, request);
      case "html": {
        if (!context.config.live || resource.file.stats.size > MAX_HTML_INJECTION_BYTES) {
          return fileResponse(resource.file, request, context.config.cors);
        }
        const source = await Bun.file(resource.file.path).text();
        return htmlResponse(injectLiveReload(source), 200, request.method, context.config.cors);
      }
      case "file":
        return fileResponse(resource.file, request, context.config.cors);
      case "redirect":
        return redirectResponse(resource.location, request.method, context.config.cors);
      case "error":
        return respondShell(context.config, resource.status, request);
      default:
        return textResponse("Unhandled resource", 500, request.method, context.config.cors);
    }
  };
}
