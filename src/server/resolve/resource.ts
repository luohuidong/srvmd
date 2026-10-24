import { extname } from "node:path";
import { CLEAN_URL_SUFFIXES } from "../../shared/constants.ts";
import { isHtmlFile, isMarkdownFile } from "../file-kinds.ts";
import type { ResolvedPath } from "../types.ts";
import { resolveRequest } from "./path.ts";

export type Resource =
  | { kind: "markdown"; file: ResolvedPath }
  | { kind: "html"; file: ResolvedPath }
  | { kind: "file"; file: ResolvedPath }
  | { kind: "directory"; directory: ResolvedPath }
  | { kind: "redirect"; location: string }
  | { kind: "error"; status: 400 | 403 | 404; reason: string };

export type ResolveOptions = {
  root: string;
  cleanUrls: boolean;
  single: boolean;
  directoryListing: boolean;
};

function classifyFile(file: ResolvedPath): Resource {
  if (isMarkdownFile(file.path)) return { kind: "markdown", file };
  if (isHtmlFile(file.path)) return { kind: "html", file };
  return { kind: "file", file };
}

async function resolveCleanUrl(root: string, pathname: string): Promise<ResolvedPath | null> {
  if (extname(pathname) !== "") return null;
  for (const suffix of CLEAN_URL_SUFFIXES) {
    const result = await resolveRequest(root, pathname + suffix);
    if (result.ok && result.resolved.stats.isFile()) return result.resolved;
  }
  return null;
}

async function resolveSingleFallback(root: string): Promise<ResolvedPath | null> {
  for (const pathname of ["/index.md", "/index.html"]) {
    const result = await resolveRequest(root, pathname);
    if (result.ok && result.resolved.stats.isFile()) return result.resolved;
  }
  return null;
}

async function resolveDirectory(options: ResolveOptions, pathname: string, directory: ResolvedPath): Promise<Resource> {
  for (const name of ["index.md", "index.html"]) {
    const candidate = await resolveRequest(options.root, `${pathname}${name}`);
    if (candidate.ok && candidate.resolved.stats.isFile()) return classifyFile(candidate.resolved);
  }

  if (!options.directoryListing) {
    return { kind: "error", status: 404, reason: "Directory listing is disabled." };
  }
  return { kind: "directory", directory };
}

/**
 * Turn a request URL into a resource the response layer can render.
 * This is the single place that knows about clean URLs, directory indexes
 * and the SPA fallback.
 */
export async function resolveResource(options: ResolveOptions, url: URL): Promise<Resource> {
  const result = await resolveRequest(options.root, url.pathname);

  if (result.ok) {
    const resolved = result.resolved;
    if (resolved.stats.isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        return { kind: "redirect", location: `${url.pathname}/${url.search}` };
      }
      return resolveDirectory(options, url.pathname, resolved);
    }
    return classifyFile(resolved);
  }

  if (result.status === 404) {
    if (options.cleanUrls) {
      const clean = await resolveCleanUrl(options.root, url.pathname);
      if (clean) return classifyFile(clean);
    }
    if (options.single) {
      const fallback = await resolveSingleFallback(options.root);
      if (fallback) return classifyFile(fallback);
    }
  }

  return { kind: "error", status: result.status, reason: result.reason };
}
