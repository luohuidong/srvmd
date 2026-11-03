import crypto from "node:crypto";
import path from "node:path";
import type { contracts, types } from "../../../shared/src/index.js";

import { assertNever } from "../assert.js";
import { buildBreadcrumbs } from "../breadcrumbs.js";
import type { ServerContext } from "../context.js";
import { stripMarkdownExtension } from "../file-kinds.js";
import type { ResolvedPath } from "../fs-path.js";
import {
  jsonError,
  jsonResponse,
  notModifiedResponse,
} from "../http/respond.js";
import { matchesEtag } from "../http/validators.js";
import type { RenderedDocument } from "../markdown/index.js";
import type { Resource } from "../resolve/resource.js";
import { type DirectoryEntry, listDirectory } from "../services/directories.js";
import type { DocumentEntry } from "../services/documents.js";

/**
 * Bump when a payload field changes without a source change, so a conditional
 * request cannot keep serving a body built by the previous contract.
 */
const PAYLOAD_SCHEMA = 3;

/**
 * Build the page validators. Keep these in sync with the payload builders below:
 * every field that changes a payload must change its ETag, or a conditional
 * request will keep serving an outdated page.
 */
function etagOf(parts: readonly string[]): string {
  return `W/"${crypto.createHash("sha1").update(parts.join("\0")).digest("hex")}"`;
}

function documentEtag(
  context: ServerContext,
  file: ResolvedPath,
  entry: DocumentEntry,
  pageUrl: URL,
  siblings: readonly types.SiblingDocument[],
): string {
  const { config } = context;
  return etagOf([
    "document",
    String(PAYLOAD_SCHEMA),
    config.version,
    pageUrl.pathname,
    file.relative,
    entry.revision,
    ...siblings.map(sibling => sibling.name),
  ]);
}

function directoryEtag(
  context: ServerContext,
  directory: ResolvedPath,
  entries: DirectoryEntry[],
  pageUrl: URL,
): string {
  return etagOf([
    "directory",
    String(PAYLOAD_SCHEMA),
    context.config.version,
    pageUrl.pathname,
    directory.relative,
    ...entries.map(
      entry =>
        `${entry.name}\0${entry.kind}\0${entry.size ?? ""}\0${entry.mtime?.getTime() ?? ""}`,
    ),
  ]);
}

/** Build the left-side document list from the current directory listing. */
function siblingDocuments(
  file: ResolvedPath,
  entries: readonly DirectoryEntry[],
): types.SiblingDocument[] {
  const directory = path.posix.dirname(file.relative);
  const base =
    directory === "."
      ? "/"
      : `/${directory
          .split("/")
          .map(segment => encodeURIComponent(segment))
          .join("/")}/`;
  const current = path.posix.basename(file.relative);

  return entries
    .filter(entry => entry.kind === "markdown")
    .map(entry => ({
      name: entry.name,
      href: `${base}${encodeURIComponent(entry.name)}`,
      active: entry.name === current,
    }));
}

function documentPayload(
  file: ResolvedPath,
  document: RenderedDocument,
  pageUrl: URL,
  siblings: types.SiblingDocument[],
): contracts.DocumentPayload {
  const directory = path.posix.dirname(file.relative);

  return {
    kind: "document",
    title: document.title ?? stripMarkdownExtension(path.basename(file.path)),
    html: document.html,
    toc: document.toc,
    siblings,
    mermaid: document.mermaid,
    breadcrumbs: buildBreadcrumbs(directory === "." ? "" : directory, {
      label: path.posix.basename(file.relative),
      href: pageUrl.pathname,
    }),
    rawHref: `${pageUrl.pathname}?raw`,
    warning: document.warning,
    lang: document.lang,
  };
}

function directoryPayload(
  directory: ResolvedPath,
  entries: DirectoryEntry[],
): contracts.DirectoryPayload {
  const displayPath = directory.relative ? `/${directory.relative}/` : "/";

  return {
    kind: "directory",
    heading: `Index of ${displayPath}`,
    parentHref: directory.relative ? "../" : undefined,
    entries: entries.map(entry => ({
      name: entry.name,
      kind: entry.kind,
      size: entry.size,
      mtime: entry.mtime?.toISOString(),
    })),
    breadcrumbs: buildBreadcrumbs(directory.relative),
  };
}

/** Turn the resolver's Resource into the JSON contract consumed by the Svelte app. */
export async function respondPageApi(
  context: ServerContext,
  resource: Resource,
  request: Request,
  pageUrl: URL,
): Promise<Response> {
  const method = request.method.toUpperCase();

  switch (resource.kind) {
    case "markdown": {
      const entry = await context.documents.get(resource.file.path);
      if (!entry) return jsonError(404, "Not found", method);

      const directoryEntries = await listDirectory(
        context.config.root,
        path.dirname(resource.file.path),
      );
      const siblings = siblingDocuments(resource.file, directoryEntries);

      const etag = documentEtag(
        context,
        resource.file,
        entry,
        pageUrl,
        siblings,
      );
      if (matchesEtag(request.headers.get("if-none-match"), etag))
        return notModifiedResponse(etag);

      return jsonResponse(
        documentPayload(resource.file, entry.document, pageUrl, siblings),
        200,
        method,
        etag,
      );
    }
    case "directory": {
      const entries = await listDirectory(
        context.config.root,
        resource.directory.path,
      );
      const etag = directoryEtag(context, resource.directory, entries, pageUrl);
      if (matchesEtag(request.headers.get("if-none-match"), etag))
        return notModifiedResponse(etag);

      return jsonResponse(
        directoryPayload(resource.directory, entries),
        200,
        method,
        etag,
      );
    }
    case "redirect": {
      const payload: contracts.RedirectPayload = {
        kind: "redirect",
        location: resource.location,
      };
      return jsonResponse(payload, 200, method);
    }
    case "error":
      return jsonError(resource.status, resource.reason, method);
    case "html":
    case "file":
      return jsonError(404, "Not a page", method);
    default:
      return assertNever(resource);
  }
}
