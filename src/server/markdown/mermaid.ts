import type { MermaidSource } from "../../shared/types.ts";
import { MERMAID_LANGUAGE } from "../constants.ts";
import { decodeEntities } from "./text.ts";

const MERMAID_BLOCK_RE = new RegExp(`<pre><code class="language-${MERMAID_LANGUAGE}">([\\s\\S]*?)</code></pre>`, "g");

export type MermaidTransform = {
  html: string;
  /** Raw diagram sources, decoded for the browser runtime. */
  sources: MermaidSource[];
};

/**
 * Turn ```mermaid fences into empty slots plus structured sources. The Svelte
 * client mounts a diagram component into each slot.
 *
 * The captured source is HTML-escaped by Bun's Markdown renderer; it is decoded
 * once here so the API can hand raw Mermaid source to the browser.
 */
export function renderMermaidBlocks(html: string): MermaidTransform {
  const sources: MermaidSource[] = [];

  const output = html.replace(MERMAID_BLOCK_RE, (_match, source: string) => {
    const id = `mermaid-${sources.length + 1}`;
    sources.push({ id, source: decodeEntities(source) });
    return `<div class="mermaid-slot" data-mermaid-slot="${id}"></div>`;
  });

  return { html: output, sources };
}
