import type { MermaidSource } from "@shared/types.ts";
import { mount, tick, unmount } from "svelte";
import MermaidDiagram from "./MermaidDiagram.svelte";

type MountedComponent = ReturnType<typeof mount>;

/**
 * Mount a Svelte diagram component into each server-rendered slot. This is the
 * single integration point between `{@html}` Markdown content and Svelte state.
 */
export function mermaidSlots(node: HTMLElement, initial: MermaidSource[]) {
  let diagrams = initial;
  let mounted: MountedComponent[] = [];
  let destroyed = false;
  let generation = 0;

  function unmountAll(): void {
    for (const component of mounted) void unmount(component);
    mounted = [];
  }

  function mountAll(): void {
    if (destroyed) return;
    unmountAll();

    const byId = new Map(diagrams.map(diagram => [diagram.id, diagram.source]));
    for (const slot of node.querySelectorAll<HTMLElement>("[data-mermaid-slot]")) {
      const id = slot.dataset.mermaidSlot;
      const source = id === undefined ? undefined : byId.get(id);
      if (source === undefined) continue;
      mounted.push(mount(MermaidDiagram, { target: slot, props: { source } }));
    }
  }

  function refresh(): void {
    const current = ++generation;
    void tick().then(() => {
      if (current === generation && !destroyed) mountAll();
    });
  }

  refresh();

  return {
    update(next: MermaidSource[]): void {
      diagrams = next;
      refresh();
    },
    destroy(): void {
      destroyed = true;
      generation++;
      unmountAll();
    },
  };
}
