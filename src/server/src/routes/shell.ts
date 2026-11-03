import type { ServerContext } from "../context.js";
import { htmlResponse, textResponse } from "../http/respond.js";

/**
 * Serve the Svelte shell for an app route. The server returns the template
 * verbatim; all page structure and content rendering lives in the web app.
 */
export async function respondShell(
  context: ServerContext,
  status: number,
  request: Request,
): Promise<Response> {
  const template = await context.web.readShell();
  if (!template) {
    return textResponse(context.web.unavailableMessage, 503, request.method);
  }

  return htmlResponse(template, status, request.method);
}
