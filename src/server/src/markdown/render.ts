import type { Highlighter } from "shiki";
import type { types } from "../../../shared/src/index.js";
import { createRenderEnv } from "./env.js";
import { parseFrontmatter } from "./frontmatter.js";
import { ensureLanguages } from "./highlight.js";
import { createMarkdownParser, fencedLanguages } from "./markdown.js";

export type RenderedDocument = {
  html: string;
  toc: types.TocItem[];
  title?: string;
  lang?: string;
  warning?: string;
  /** Structured diagram sources for the Svelte client. */
  mermaid: types.MermaidSource[];
};

type RendererOptions = {
  highlighter: Highlighter | null;
};

export type Renderer = {
  render(source: string): Promise<RenderedDocument>;
};

export function createRenderer(options: RendererOptions): Renderer {
  const { highlighter } = options;
  const md = createMarkdownParser(highlighter);

  return {
    async render(source) {
      const frontmatter = parseFrontmatter(source);
      const env = createRenderEnv();
      const tokens = md.parse(frontmatter.body, env);

      // shiki loading is async, so the language set is resolved between parse
      // and render: the rules need the grammars before the fence rule runs.
      if (highlighter) {
        await ensureLanguages(highlighter, fencedLanguages(tokens));
      }

      const html = md.renderer.render(tokens, md.options, env);

      const titleValue = frontmatter.data.title;
      const title =
        typeof titleValue === "string"
          ? titleValue
          : titleValue == null
            ? env.toc.find(item => item.level === 1)?.text
            : String(titleValue);
      const langValue = frontmatter.data.lang;

      return {
        html,
        toc: env.toc,
        title,
        lang: typeof langValue === "string" ? langValue : undefined,
        warning: frontmatter.error,
        mermaid: env.mermaid,
      };
    },
  };
}
