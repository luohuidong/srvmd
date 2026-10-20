import type { ResolvedTheme } from "@shared/types.ts";
import { loadMermaid, type MermaidApi, type MermaidRenderResult } from "./load.ts";

let initialized: ResolvedTheme | null = null;
let queue: Promise<void> = Promise.resolve();
let nextId = 0;

function initialize(api: MermaidApi, theme: ResolvedTheme): void {
  if (initialized === theme) return;

  api.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: theme === "dark" ? "dark" : "default",
    themeVariables: { background: "transparent" },
    fontFamily: typeof document === "undefined" ? undefined : getComputedStyle(document.body).fontFamily,
  });
  initialized = theme;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Render Mermaid source to SVG. Every call gets a unique Mermaid render id so
 * that the same diagram can appear inline and in the viewer without duplicate
 * SVG ids. Renders are serialized because Mermaid's configuration is global.
 */
export function renderDiagram(source: string, theme: ResolvedTheme): Promise<MermaidRenderResult> {
  return enqueue(async () => {
    const api = await loadMermaid();
    initialize(api, theme);
    nextId += 1;
    return api.render(`serve-md-mermaid-${nextId}`, source);
  });
}
