import {
  type Highlighter,
  createHighlighter as shikiCreateHighlighter,
} from "shiki";

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
    console.warn(
      `[srvmd] syntax highlighting disabled: ${error instanceof Error ? error.message : error}`,
    );
    return null;
  }
}

/**
 * Load fence languages that are not loaded yet. Unknown languages are ignored:
 * their fence falls back to a plain `<pre><code>` block.
 */
export async function ensureLanguages(
  highlighter: Highlighter,
  languages: Iterable<string>,
): Promise<void> {
  const loaded = new Set(highlighter.getLoadedLanguages());
  await Promise.all(
    [...languages].map(async language => {
      if (loaded.has(language)) return;
      try {
        await highlighter.loadLanguage(language as never);
        loaded.add(language);
      } catch {
        // Unknown language: the block stays plain.
      }
    }),
  );
}

/**
 * Highlight one fenced block. Returns undefined for unknown languages so the
 * caller can fall back to a plain block instead of losing the code.
 */
export function highlightCode(
  highlighter: Highlighter,
  language: string,
  code: string,
): string | undefined {
  // Fence tokens keep the final newline; shiki would render it as a blank line.
  const source = code.replace(/\n$/, "");
  const cache = cacheFor(highlighter);
  // The key covers everything codeToHtml() depends on: language, code and the
  // fixed theme pair above. Add the theme here if it ever becomes configurable.
  const key = `${language}\0${source}`;
  const cached = recall(cache, key);
  if (cached !== undefined) return cached;

  try {
    const highlighted = highlighter.codeToHtml(source, {
      lang: language,
      themes: { light: THEMES.light, dark: THEMES.dark },
    });
    remember(cache, key, highlighted);
    return highlighted;
  } catch {
    return undefined;
  }
}
