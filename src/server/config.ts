import { realpath, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "../../package.json";
import type { Theme } from "../shared/types.ts";
import type { HtmlMode } from "./types.ts";

export type ServeMarkdownOptions = {
  /** Directory to serve. Default: process.cwd() */
  root?: string;
  /** Listening port. Use 0 for a random free port. Default: 3000 */
  port?: number;
  /** Interface to bind. Default: 0.0.0.0 */
  hostname?: string;
  /** Push reload events over WebSocket. Default: true */
  live?: boolean;
  /** Highlight fenced code blocks. Default: true */
  highlight?: boolean;
  /** Resolve /page to page.md / page.html. Default: true */
  cleanUrls?: boolean;
  /** Render directory indexes. Default: true */
  directoryListing?: boolean;
  /** Serve index.html (or index.md) for unmatched routes. Default: false */
  single?: boolean;
  /** Send permissive CORS headers. Default: false */
  cors?: boolean;
  /** Default color theme. Default: "auto" */
  theme?: Theme;
  /** Raw HTML handling: "filter" (GFM tag filter), "allow", or "off". Default: "filter" */
  html?: HtmlMode;
  /** Enable LaTeX math. Default: false */
  math?: boolean;
  /** Render ```mermaid fences as interactive diagrams. Default: true */
  mermaid?: boolean;
  /** Extra directory/file names the watcher should ignore. */
  ignore?: string[];
  /** Built Svelte assets. Defaults to `<package>/web/dist`. */
  webRoot?: string;
};

export type ResolvedConfig = {
  root: string;
  rootLabel: string;
  port: number;
  hostname: string;
  live: boolean;
  highlight: boolean;
  cleanUrls: boolean;
  directoryListing: boolean;
  single: boolean;
  cors: boolean;
  theme: Theme;
  html: HtmlMode;
  math: boolean;
  mermaid: boolean;
  ignore: string[];
  webRoot: string;
  version: string;
};

const THEMES: Theme[] = ["auto", "light", "dark"];
const HTML_MODES: HtmlMode[] = ["filter", "allow", "off"];
const DEFAULT_WEB_ROOT = fileURLToPath(new URL("../../web/dist", import.meta.url));

/** Normalize user options into a fully resolved, validated config. */
export async function resolveConfig(options: ServeMarkdownOptions = {}): Promise<ResolvedConfig> {
  const requestedRoot = resolve(options.root ?? process.cwd());
  const root = await realpath(requestedRoot).catch(() => null);
  if (!root) throw new Error(`Directory not found: ${requestedRoot}`);

  const info = await stat(root);
  if (!info.isDirectory()) throw new Error(`Not a directory: ${requestedRoot}`);

  const theme = options.theme ?? "auto";
  if (!THEMES.includes(theme)) throw new Error(`Invalid theme: ${theme}. Use auto, light or dark.`);

  const html = options.html ?? "filter";
  if (!HTML_MODES.includes(html)) throw new Error(`Invalid html mode: ${html}. Use filter, allow or off.`);

  return {
    root,
    rootLabel: basename(root) || "/",
    port: options.port ?? 3000,
    hostname: options.hostname ?? "0.0.0.0",
    live: options.live !== false,
    highlight: options.highlight !== false,
    cleanUrls: options.cleanUrls !== false,
    directoryListing: options.directoryListing !== false,
    single: options.single === true,
    cors: options.cors === true,
    theme,
    html,
    math: options.math === true,
    mermaid: options.mermaid !== false,
    ignore: options.ignore ?? [],
    webRoot: resolve(options.webRoot ?? DEFAULT_WEB_ROOT),
    version: pkg.version,
  };
}
