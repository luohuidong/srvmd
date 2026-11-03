import { isHtmlFile, isMarkdownFile } from "../file-kinds.js";
import type { ResolvedPath } from "../fs-path.js";
import { resolveRequest } from "./request.js";

export type Resource =
  | { kind: "markdown"; file: ResolvedPath }
  | { kind: "html"; file: ResolvedPath }
  | { kind: "file"; file: ResolvedPath }
  | { kind: "directory"; directory: ResolvedPath }
  | { kind: "redirect"; location: string }
  | { kind: "error"; status: 400 | 403 | 404; reason: string };

function classifyFile(file: ResolvedPath): Resource {
  if (isMarkdownFile(file.path)) return { kind: "markdown", file };
  if (isHtmlFile(file.path)) return { kind: "html", file };
  return { kind: "file", file };
}

/**
 * Turn a request URL into a resource the response layer can render.
 * This is the single place that knows about directories and files.
 */
export async function resolveResource(
  root: string,
  url: URL,
): Promise<Resource> {
  const result = await resolveRequest(root, url.pathname);

  if (result.ok) {
    const resolved = result.resolved;
    if (resolved.stats.isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        return { kind: "redirect", location: `${url.pathname}/${url.search}` };
      }
      return { kind: "directory", directory: resolved };
    }
    return classifyFile(resolved);
  }

  return { kind: "error", status: result.status, reason: result.reason };
}
