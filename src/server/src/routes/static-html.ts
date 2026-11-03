import fsp from "node:fs/promises";
import { MAX_HTML_INJECTION_BYTES } from "../constants.js";
import type { ResolvedPath } from "../fs-path.js";
import { fileResponse, htmlResponse } from "../http/respond.js";

/** Append the live-reload module to a static HTML document. */
function injectLiveReload(html: string, liveClientPath: string): string {
  const snippet = `<script type="module" src="${liveClientPath}"></script>`;
  const match = /<\/body\s*>/i.exec(html);
  if (!match || match.index === undefined) return html + snippet;
  return html.slice(0, match.index) + snippet + html.slice(match.index);
}

/**
 * Serve user HTML unchanged, apart from the live-reload module. Large files are
 * streamed as-is so the server does not buffer them just to append a script.
 */
export async function respondStaticHtml(
  file: ResolvedPath,
  request: Request,
  liveClientPath: string,
): Promise<Response> {
  if (file.stats.size > MAX_HTML_INJECTION_BYTES)
    return fileResponse(file, request);

  const source = await fsp.readFile(file.path, "utf8");
  return htmlResponse(
    injectLiveReload(source, liveClientPath),
    200,
    request.method,
  );
}
