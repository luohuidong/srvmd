import type {
  MarkdownIt as MarkdownItInstance,
  StateCore,
  Token,
} from "markdown-it";
import type { RenderEnv } from "./env.js";

/**
 * Give every heading an id, a `heading` class and a `#` anchor, and collect the
 * table of contents in document order.
 *
 * Ids are generated here instead of by a Markdown implementation: the inline
 * text is already available as tokens, and slugging locally keeps non-ASCII
 * headings addressable. A default slugger that drops non-ASCII letters would
 * turned `# 中文` into `id=""` and `# 日本語` into `id="-1"`.
 */
export function installHeadingIds(md: MarkdownItInstance): void {
  md.core.ruler.push("srvmd_headings", state => {
    const env = state.env as RenderEnv;

    for (let index = 0; index < state.tokens.length; index++) {
      const open = state.tokens[index];
      if (open?.type !== "heading_open") continue;

      const inline = state.tokens[index + 1];
      if (inline?.type !== "inline") continue;

      const text = inlineText(inline);
      if (!text) continue;

      const id = uniqueId(env.ids, text);
      open.attrSet("id", id);
      open.attrJoin("class", "heading");
      env.toc.push({ level: Number(open.tag.slice(1)), id, text });
      inline.children = withAnchor(state, id, inline.children);
    }
  });
}

/** Text of a heading with inline markup removed, as shown in the TOC. */
function inlineText(token: Token): string {
  let text = "";
  for (const child of token.children ?? []) {
    switch (child.type) {
      case "text":
      case "code_inline":
      case "image":
        text += child.content;
        break;
      // Inline HTML is text for the reader: `Press <kbd>Ctrl</kbd>` should
      // still show up as "Press Ctrl" in the TOC.
      case "html_inline":
        text += child.content.replace(/<[^>]*>/g, "");
        break;
      case "softbreak":
      case "hardbreak":
        text += " ";
        break;
      default:
        break;
    }
  }
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Keep Unicode letters, numbers and marks so CJK headings keep readable,
 * unique anchors. Everything else becomes a dash separator.
 */
function slugify(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueId(used: Set<string>, text: string): string {
  const base = slugify(text) || "section";
  let id = base;
  let suffix = 1;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

/** Prepend the hoverable anchor link that `markdown.css` styles. */
function withAnchor(
  state: StateCore,
  id: string,
  children: Token[] | null,
): Token[] {
  const open = new state.Token("link_open", "a", 1);
  open.attrSet("class", "heading-anchor");
  open.attrSet("href", `#${id}`);
  open.attrSet("aria-hidden", "true");

  const marker = new state.Token("text", "", 0);
  marker.content = "#";

  const close = new state.Token("link_close", "a", -1);
  return [open, marker, close, ...(children ?? [])];
}
