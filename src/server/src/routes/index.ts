import { constants } from "../../../shared/src/index.js";
import { assertNever } from "../assert.js";
import { respondMermaidRuntime } from "../assets/mermaid.js";
import type { ServerContext } from "../context.js";
import {
  fileResponse,
  methodNotAllowedResponse,
  redirectResponse,
  textResponse,
} from "../http/respond.js";
import { resolveResource } from "../resolve/resource.js";
import { respondPageApi } from "./page-api.js";
import { respondShell } from "./shell.js";
import { respondStaticHtml } from "./static-html.js";

type RequestHandler = (request: Request) => Promise<Response>;

/** Convert `/__api/page/<path>` back into the user-facing URL it describes. */
function pageUrlFromApi(url: URL): URL {
  const pageUrl = new URL(url);
  const suffix = url.pathname.slice(constants.API_PAGE_PATH.length);
  pageUrl.pathname = suffix === "" ? "/" : suffix;
  pageUrl.search = "";
  return pageUrl;
}

/**
 * HTTP entry point:
 * live socket -> method guard -> internal routes -> resolve.
 */
export function createRequestHandler(context: ServerContext): RequestHandler {
  return async request => {
    const url = new URL(request.url);

    if (url.pathname === constants.LIVE_PATH) {
      // Upgrade requests are handled by the HTTP server's upgrade event.
      return textResponse("WebSocket upgrade required", 426, request.method);
    }

    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD")
      return methodNotAllowedResponse();

    if (url.pathname === constants.MERMAID_RUNTIME_PATH) {
      return respondMermaidRuntime(request);
    }

    if (
      url.pathname === constants.APP_ASSET_PREFIX ||
      url.pathname.startsWith(`${constants.APP_ASSET_PREFIX}/`)
    ) {
      return context.web.respondAsset(url, request);
    }

    if (
      url.pathname === constants.API_PAGE_PATH ||
      url.pathname.startsWith(`${constants.API_PAGE_PATH}/`)
    ) {
      const pageUrl = pageUrlFromApi(url);
      const resource = await resolveResource(context.config.root, pageUrl);
      return respondPageApi(context, resource, request, pageUrl);
    }

    const resource = await resolveResource(context.config.root, url);

    if (resource.kind === "markdown" && url.searchParams.has("raw")) {
      return fileResponse(
        resource.file,
        request,
        "text/markdown; charset=utf-8",
      );
    }

    switch (resource.kind) {
      case "markdown":
      case "directory":
        return respondShell(context, 200, request);
      case "html":
        return respondStaticHtml(
          resource.file,
          request,
          context.web.liveStaticPath,
        );
      case "file":
        return fileResponse(resource.file, request);
      case "redirect":
        return redirectResponse(resource.location, request.method);
      case "error":
        return respondShell(context, resource.status, request);
      default:
        return assertNever(resource);
    }
  };
}
