import type { types } from "../../../shared/src/index.js";

/**
 * Replace a `mermaid` fence with an empty slot plus a structured source.
 *
 * The server never builds diagram HTML: the Svelte client mounts a diagram
 * component into each slot. Fence content is raw Markdown, so no HTML entity
 * decoding is needed before it reaches the browser.
 */
export function createMermaidSlot(
  sources: types.MermaidSource[],
  source: string,
): string {
  const id = `mermaid-${sources.length + 1}`;
  sources.push({ id, source });
  return `<div class="mermaid-slot" data-mermaid-slot="${id}"></div>`;
}
