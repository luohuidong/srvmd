import MarkdownIt, {
  type MarkdownIt as MarkdownItInstance,
  type Token,
} from "markdown-it";
import type { Highlighter } from "shiki";
import { MERMAID_LANGUAGE } from "../constants.js";
import type { RenderEnv } from "./env.js";
import { installHeadingIds } from "./headings.js";
import { highlightCode } from "./highlight.js";
import { createMermaidSlot } from "./mermaid.js";
import { installTaskLists } from "./task-list.js";

/**
 * The Markdown parser owned by the server context.
 *
 * Everything that used to be regex post-processing over a rendered HTML string
 * is a token rule now: heading ids and anchors, task lists, table of contents,
 * Mermaid slots and shiki fences. The HTML shape is therefore ours, not a
 * dependency's, and only shiki's own output is treated as opaque.
 */
export function createMarkdownParser(
  highlighter: Highlighter | null,
): MarkdownItInstance {
  const md = new MarkdownIt({ html: true, linkify: true });

  // Raw HTML stays part of the contract (see `render.test.ts`). linkify only
  // handles URLs with a scheme and emails: fuzzy links would also turn plain
  // filenames and hosts (`README.md`, `main.rs`, `example.com`) into external links,
  // which neither GFM nor a docs server should do.
  md.linkify.set({ fuzzyLink: false, fuzzyEmail: true });

  installHeadingIds(md);
  installTaskLists(md);

  md.renderer.rules.fence = (tokens, index, _options, env) => {
    const token = tokens[index];
    if (!token) return "";

    const language = fenceLanguage(token);
    if (language === MERMAID_LANGUAGE) {
      return `${createMermaidSlot((env as RenderEnv).mermaid, token.content)}\n`;
    }

    if (highlighter && language) {
      const highlighted = highlightCode(highlighter, language, token.content);
      if (highlighted !== undefined) return `${highlighted}\n`;
    }

    return renderPlainFence(md, token, language);
  };

  return md;
}

/** Fence languages shiki must load before the render pass runs. */
export function fencedLanguages(tokens: readonly Token[]): string[] {
  const languages = new Set<string>();
  for (const token of tokens) {
    if (token.type !== "fence") continue;
    const language = fenceLanguage(token);
    if (language && language !== MERMAID_LANGUAGE) languages.add(language);
  }
  return [...languages];
}

/** First word of the info string, lowercased: `ts title="x"` -> `ts`. */
function fenceLanguage(token: Token): string {
  return token.info.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

/**
 * The same `<pre><code class="language-x">` shape markdown-it emits by default,
 * written here so a missing highlighter never falls back into library internals.
 */
function renderPlainFence(
  md: MarkdownItInstance,
  token: Token,
  language: string,
): string {
  const className = language
    ? ` class="language-${md.utils.escapeHtml(md.utils.unescapeAll(language))}"`
    : "";
  return `<pre><code${className}>${md.utils.escapeHtml(token.content)}</code></pre>\n`;
}
