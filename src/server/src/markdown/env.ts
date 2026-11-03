import type { types } from "../../../shared/src/index.js";

/**
 * Per-document state shared by the parser rules and the render pass.
 *
 * The heading and task list rules install HTML while `parse()` runs, the fence
 * renderer appends diagram sources while `render()` runs, and `render.ts` reads
 * both lists once the HTML exists.
 */
export type RenderEnv = {
  toc: types.TocItem[];
  mermaid: types.MermaidSource[];
  /** Heading ids already used, so a generated id never repeats. */
  ids: Set<string>;
};

export function createRenderEnv(): RenderEnv {
  return { toc: [], mermaid: [], ids: new Set() };
}
