import { basename } from "node:path";
import { buildBreadcrumbs } from "../../shared/breadcrumbs.ts";
import type { DirectoryPayload, DocumentPayload, RedirectPayload } from "../../shared/contracts.ts";
import type { ServerContext } from "../context.ts";
import { stripMarkdownExtension } from "../file-kinds.ts";
import { jsonError, jsonResponse, notModifiedResponse } from "../http/respond.ts";
import { matchesEtag } from "../http/validators.ts";
import type { RenderedDocument } from "../markdown/index.ts";
import type { Resource } from "../resolve/resource.ts";
import { listDirectory } from "../services/directories.ts";
import type { DocumentEntry } from "../services/documents.ts";
import type { DirectoryEntry, ResolvedPath } from "../types.ts";

/**
 * Build the page validators. Keep these in sync with the payload builders below:
 * every field that changes a payload must change its ETag, or a conditional
 * request will keep serving an outdated page.
 */
function etagOf(parts: readonly string[]): string {
  return `W/"${Bun.hash(parts.join("\0")).toString(16)}"`;
}

function documentEtag(context: ServerContext, file: ResolvedPath, entry: DocumentEntry, url: URL): string {
  const { config } = context;
  return etagOf([
    "document",
    config.version,
    config.rootLabel,
    config.html,
    config.highlight ? "highlight" : "plain",
    config.math ? "math" : "no-math",
    config.mermaid ? "mermaid" : "no-mermaid",
    url.pathname,
    file.relative,
    entry.revision,
  ]);
}

function directoryEtag(context: ServerContext, directory: ResolvedPath, entries: DirectoryEntry[], url: URL): string {
  return etagOf([
    "directory",
    context.config.version,
    context.config.rootLabel,
    url.pathname,
    directory.relative,
    ...entries.map(entry => `${entry.name}\0${entry.kind}\0${entry.size ?? ""}\0${entry.mtime?.getTime() ?? ""}`),
  ]);
}

function documentPayload(
  context: ServerContext,
  file: ResolvedPath,
  document: RenderedDocument,
  url: URL,
): DocumentPayload {
  const directory = file.relative.includes("/") ? file.relative.slice(0, file.relative.lastIndexOf("/")) : "";
  const lang = document.frontmatter.lang;

  return {
    kind: "document",
    path: url.pathname,
    title: document.title ?? stripMarkdownExtension(basename(file.path)),
    html: document.html,
    toc: document.toc,
    mermaid: document.mermaid,
    breadcrumbs: buildBreadcrumbs(context.config.rootLabel, directory),
    rawHref: `${url.pathname}?raw`,
    warning: document.warning,
    lang: typeof lang === "string" ? lang : undefined,
  };
}

function directoryPayload(
  context: ServerContext,
  directory: ResolvedPath,
  entries: DirectoryEntry[],
): DirectoryPayload {
  const displayPath = directory.relative ? `/${directory.relative}/` : "/";

  return {
    kind: "directory",
    path: displayPath,
    heading: `Index of ${displayPath}`,
    parentHref: directory.relative ? "../" : undefined,
    entries: entries.map(entry => ({
      name: entry.name,
      kind: entry.kind,
      size: entry.size,
      mtime: entry.mtime?.toISOString(),
    })),
    breadcrumbs: buildBreadcrumbs(context.config.rootLabel, directory.relative),
  };
}

/** Turn the resolver's Resource into the JSON contract consumed by the Svelte app. */
export async function respondPageApi(
  context: ServerContext,
  resource: Resource,
  request: Request,
  url: URL,
): Promise<Response> {
  const { config } = context;
  const method = request.method.toUpperCase();

  switch (resource.kind) {
    case "markdown": {
      const entry = await context.documents.get(resource.file.path);
      const etag = documentEtag(context, resource.file, entry, url);
      if (matchesEtag(request.headers.get("if-none-match"), etag)) return notModifiedResponse(etag, config.cors);

      return jsonResponse(documentPayload(context, resource.file, entry.document, url), 200, method, config.cors, etag);
    }
    case "directory": {
      const entries = await listDirectory(resource.directory.path, config.root);
      const etag = directoryEtag(context, resource.directory, entries, url);
      if (matchesEtag(request.headers.get("if-none-match"), etag)) return notModifiedResponse(etag, config.cors);

      return jsonResponse(directoryPayload(context, resource.directory, entries), 200, method, config.cors, etag);
    }
    case "redirect": {
      const payload: RedirectPayload = { kind: "redirect", location: resource.location };
      return jsonResponse(payload, 200, method, config.cors);
    }
    case "error":
      return jsonError(resource.status, resource.reason, method, config.cors);
    case "html":
    case "file":
      return jsonError(404, "Not a page", method, config.cors);
    default:
      return jsonError(500, "Unhandled resource", method, config.cors);
  }
}
