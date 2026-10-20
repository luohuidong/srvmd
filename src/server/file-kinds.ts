import { MARKDOWN_EXTENSION_RE, MARKDOWN_EXTENSIONS } from "./constants.ts";

export function isMarkdownFile(path: string): boolean {
  const index = path.lastIndexOf(".");
  return index !== -1 && MARKDOWN_EXTENSIONS.has(path.slice(index).toLowerCase());
}

export function isHtmlFile(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".html") || lower.endsWith(".htm");
}

export function stripMarkdownExtension(name: string): string {
  return name.replace(MARKDOWN_EXTENSION_RE, "");
}
