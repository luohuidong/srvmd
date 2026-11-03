import { MARKDOWN_EXTENSION_RE } from "./constants.js";

export function isMarkdownFile(path: string): boolean {
  return MARKDOWN_EXTENSION_RE.test(path);
}

export function isHtmlFile(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".html") || lower.endsWith(".htm");
}

export function stripMarkdownExtension(name: string): string {
  return name.replace(MARKDOWN_EXTENSION_RE, "");
}
