import type { TocItem } from "../../shared/types.ts";
import { stripTags } from "./text.ts";

const HEADING_RE = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
const ID_ATTR_RE = /\bid="([^"]*)"/;

/** Pull a table of contents out of the HTML Bun generated (ids come from Bun). */
export function extractToc(html: string): TocItem[] {
  const toc: TocItem[] = [];
  for (const match of html.matchAll(HEADING_RE)) {
    const level = Number(match[1]);
    const attrs = match[2] ?? "";
    const id = ID_ATTR_RE.exec(attrs)?.[1];
    if (!id) continue;
    const text = stripTags(match[3] ?? "").trim();
    if (!text) continue;
    toc.push({ level, id, text });
  }
  return toc;
}

/** Add a hoverable # anchor next to every heading that has an id. */
export function injectHeadingAnchors(html: string): string {
  return html.replace(HEADING_RE, (match, level: string, attrs: string, inner: string) => {
    const id = ID_ATTR_RE.exec(attrs)?.[1];
    if (!id || /\bclass="/.test(attrs)) return match;
    return `<h${level}${attrs} class="heading"><a class="heading-anchor" href="#${id}" aria-hidden="true">#</a>${inner}</h${level}>`;
  });
}
