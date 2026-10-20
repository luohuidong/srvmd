import type { Highlighter } from "shiki";
import type { MermaidSource, TocItem } from "../../shared/types.ts";
import { MERMAID_LANGUAGE } from "../constants.ts";
import type { FrontmatterData, HtmlMode } from "../types.ts";
import { parseFrontmatter } from "./frontmatter.ts";
import { createHighlighterService, ensureLanguages, highlightCodeBlocks } from "./highlight.ts";
import { renderMermaidBlocks } from "./mermaid.ts";
import { extractToc, injectHeadingAnchors } from "./toc.ts";

export type RenderOptions = {
  /** Syntax highlight fenced code blocks with shiki. Default: true. */
  highlight?: boolean;
  /** How to treat raw HTML inside Markdown. Default: "filter". */
  html?: HtmlMode;
  /** Enable $inline$ / $$display$$ math. Default: false. */
  math?: boolean;
  /** Render ```mermaid fences as client-side diagrams. Default: true. */
  mermaid?: boolean;
  /** Reuse an existing shiki instance (the server does this). */
  highlighter?: Highlighter | null;
};

export type RenderedDocument = {
  html: string;
  toc: TocItem[];
  title?: string;
  frontmatter: FrontmatterData;
  warning?: string;
  /** Structured diagram sources for the Svelte client. */
  mermaid: MermaidSource[];
  raw: string;
};

export type RendererOptions = {
  highlighter: Highlighter | null;
  html: HtmlMode;
  math: boolean;
  /** Render ```mermaid fences as client-side diagrams. Default: true. */
  mermaid?: boolean;
};

export type Renderer = {
  render(source: string): Promise<RenderedDocument>;
};

export function createRenderer(options: RendererOptions): Renderer {
  return {
    async render(source) {
      const frontmatter = parseFrontmatter(source);
      const { highlighter } = options;
      const mermaidEnabled = options.mermaid !== false;

      if (highlighter)
        await ensureLanguages(highlighter, frontmatter.body, mermaidEnabled ? MERMAID_LANGUAGE : undefined);

      let html = Bun.markdown.html(frontmatter.body, {
        tables: true,
        strikethrough: true,
        tasklists: true,
        autolinks: true,
        headings: { ids: true },
        latexMath: options.math,
        tagFilter: options.html === "filter",
        noHtmlBlocks: options.html === "off",
        noHtmlSpans: options.html === "off",
      });

      let mermaidSources: MermaidSource[] = [];
      if (mermaidEnabled) {
        const mermaid = renderMermaidBlocks(html);
        html = mermaid.html;
        mermaidSources = mermaid.sources;
      }

      if (highlighter) html = highlightCodeBlocks(html, highlighter);

      const toc = extractToc(html);
      html = injectHeadingAnchors(html);

      const titleValue = frontmatter.data.title;
      const title =
        typeof titleValue === "string"
          ? titleValue
          : titleValue == null
            ? toc.find(item => item.level === 1)?.text
            : String(titleValue);

      return {
        html,
        toc,
        title,
        frontmatter: frontmatter.data,
        warning: frontmatter.error,
        mermaid: mermaidSources,
        raw: source,
      };
    },
  };
}

/**
 * Convenience API for one-off rendering. When no highlighter is supplied and
 * highlighting is enabled, a temporary instance is created and disposed.
 */
export async function renderMarkdown(source: string, options: RenderOptions = {}): Promise<RenderedDocument> {
  const ownsHighlighter = options.highlight !== false && !options.highlighter;
  const highlighter = options.highlighter ?? (ownsHighlighter ? await createHighlighterService() : null);

  try {
    return await createRenderer({
      highlighter,
      html: options.html ?? "filter",
      math: options.math === true,
      mermaid: options.mermaid !== false,
    }).render(source);
  } finally {
    if (ownsHighlighter) highlighter?.dispose();
  }
}
