import { type Highlighter, createHighlighter as shikiCreateHighlighter } from "shiki";
import { decodeEntities } from "./text.ts";

const THEMES = { light: "github-light", dark: "github-dark" } as const;

/**
 * Languages bundled eagerly. Anything else is loaded lazily on first use,
 * so docs only pay for what they contain.
 */
const PRELOADED_LANGUAGES = [
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "diff",
  "docker",
  "go",
  "graphql",
  "html",
  "ini",
  "java",
  "javascript",
  "json",
  "jsx",
  "markdown",
  "php",
  "python",
  "ruby",
  "rust",
  "scss",
  "sql",
  "svelte",
  "toml",
  "tsx",
  "typescript",
  "vue",
  "xml",
  "yaml",
];

const CODE_BLOCK_RE = /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g;
const FENCE_RE = /^(?:```|~~~)[ \t]*([A-Za-z0-9_+#.-]+)/gm;

/**
 * Create a highlighter instance. Returns null when highlighting is
 * unavailable so callers can continue without it. No module-level singleton:
 * the instance is owned by the server context.
 */
export async function createHighlighterService(): Promise<Highlighter | null> {
  try {
    return await shikiCreateHighlighter({
      themes: [THEMES.light, THEMES.dark],
      langs: PRELOADED_LANGUAGES,
    });
  } catch (error) {
    console.warn(`[serve-markdown] syntax highlighting disabled: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

/** Load every language fenced in the document that is not loaded yet. */
export async function ensureLanguages(
  highlighter: Highlighter,
  markdown: string,
  skipLanguage?: string,
): Promise<void> {
  const requested = new Set<string>();
  for (const match of markdown.matchAll(FENCE_RE)) {
    const language = match[1]?.toLowerCase();
    if (language && language !== skipLanguage) requested.add(language);
  }

  const loaded = new Set(highlighter.getLoadedLanguages());
  await Promise.all(
    [...requested].map(async language => {
      if (loaded.has(language)) return;
      try {
        await highlighter.loadLanguage(language as never);
        loaded.add(language);
      } catch {
        // Unknown language: the block falls back to plain <pre><code>.
      }
    }),
  );
}

export function highlightCodeBlocks(html: string, highlighter: Highlighter): string {
  return html.replace(CODE_BLOCK_RE, (match, language: string, escaped: string) => {
    const code = decodeEntities(escaped).replace(/\n$/, "");
    try {
      return highlighter.codeToHtml(code, {
        lang: language,
        themes: { light: THEMES.light, dark: THEMES.dark },
      });
    } catch {
      return match;
    }
  });
}
