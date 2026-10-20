import { resolve } from "node:path";
import type { ServeMarkdownOptions } from "../server/config.ts";
import type { HtmlMode } from "../server/types.ts";
import type { Theme } from "../shared/types.ts";
import { parseListen } from "./listen.ts";

export type RawCliOptions = {
  listen: string;
  open?: boolean;
  single?: boolean;
  cors?: boolean;
  theme: string;
  html: string;
  math?: boolean;
  ignore?: string[];
  live: boolean;
  highlight: boolean;
  mermaid: boolean;
  cleanUrls: boolean;
  directoryListing: boolean;
};

const THEMES: Theme[] = ["auto", "light", "dark"];
const HTML_MODES: HtmlMode[] = ["filter", "allow", "off"];

/** Map Commander's raw values onto the public server options contract. */
export function toServerOptions(directory: string, raw: RawCliOptions): ServeMarkdownOptions {
  const theme = raw.theme as Theme;
  if (!THEMES.includes(theme)) throw new Error(`Invalid --theme value: ${raw.theme}`);

  const html = raw.html as HtmlMode;
  if (!HTML_MODES.includes(html)) throw new Error(`Invalid --html value: ${raw.html}`);

  const { hostname, port } = parseListen(raw.listen);

  return {
    root: resolve(directory),
    port,
    hostname,
    live: raw.live !== false,
    highlight: raw.highlight !== false,
    cleanUrls: raw.cleanUrls !== false,
    directoryListing: raw.directoryListing !== false,
    single: raw.single === true,
    cors: raw.cors === true,
    theme,
    html,
    math: raw.math === true,
    mermaid: raw.mermaid !== false,
    ignore: raw.ignore,
  };
}
