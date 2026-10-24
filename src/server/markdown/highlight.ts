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

/** Per-highlighter output cache. Most code blocks survive a document edit unchanged. */
const MAX_CACHE_CHARS = 4 * 1024 * 1024;

type HighlightCache = {
  entries: Map<string, string>;
  chars: number;
};

const caches = new WeakMap<Highlighter, HighlightCache>();

function cacheFor(highlighter: Highlighter): HighlightCache {
  let cache = caches.get(highlighter);
  if (!cache) {
    cache = { entries: new Map(), chars: 0 };
    caches.set(highlighter, cache);
  }
  return cache;
}

function recall(cache: HighlightCache, key: string): string | undefined {
  const value = cache.entries.get(key);
  if (value === undefined) return undefined;

  // Refresh LRU order.
  cache.entries.delete(key);
  cache.entries.set(key, value);
  return value;
}

function remember(cache: HighlightCache, key: string, value: string): void {
  const cost = key.length + value.length;
  if (cost > MAX_CACHE_CHARS) return;

  cache.entries.set(key, value);
  cache.chars += cost;

  while (cache.chars > MAX_CACHE_CHARS) {
    const oldest = cache.entries.entries().next().value;
    if (!oldest) break;
    const [oldKey, oldValue] = oldest;
    cache.entries.delete(oldKey);
    cache.chars -= oldKey.length + oldValue.length;
  }
}

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
    console.warn(`[srvmd] syntax highlighting disabled: ${error instanceof Error ? error.message : error}`);
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
  const cache = cacheFor(highlighter);

  return html.replace(CODE_BLOCK_RE, (match, language: string, escaped: string) => {
    const code = decodeEntities(escaped).replace(/\n$/, "");
    // The key covers everything codeToHtml() depends on: language, code and
    // the fixed theme pair above. Add the theme here if it ever becomes configurable.
    const key = `${language}\0${code}`;
    const cached = recall(cache, key);
    if (cached !== undefined) return cached;

    try {
      const highlighted = highlighter.codeToHtml(code, {
        lang: language,
        themes: { light: THEMES.light, dark: THEMES.dark },
      });
      remember(cache, key, highlighted);
      return highlighted;
    } catch {
      return match;
    }
  });
}
