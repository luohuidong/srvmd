import type { types } from "@shared";
import { mount, tick, unmount } from "svelte";
import MermaidDiagram from "./MermaidDiagram.svelte";

type MountedComponent = ReturnType<typeof mount>;

type MountedDiagram = {
  id: string;
  source: string;
  target: HTMLElement;
  component: MountedComponent;
};

/**
 * Mount a Svelte diagram component into each server-rendered slot. This is the
 * single integration point between `{@html}` Markdown content and Svelte state.
 *
 * Updates reuse components whose slot and source are unchanged. When `{@html}`
 * replaces the body, the old targets are detached and those diagrams remount.
 */
export function mermaidSlots(
  node: HTMLElement,
  initial: types.MermaidSource[],
) {
  let diagrams = initial;
  let mounted: MountedDiagram[] = [];
  let destroyed = false;
  let generation = 0;

  function unmountAll(): void {
    for (const item of mounted) void unmount(item.component);
    mounted = [];
  }

  function mountAll(): void {
    if (destroyed) return;

    const byId = new Map(diagrams.map(diagram => [diagram.id, diagram.source]));
    const previous = new Map(mounted.map(item => [item.id, item]));
    const next: MountedDiagram[] = [];

    for (const target of node.querySelectorAll<HTMLElement>(
      "[data-mermaid-slot]",
    )) {
      const id = target.dataset.mermaidSlot;
      if (id === undefined) continue;
      const source = byId.get(id);
      if (source === undefined) continue;

      const existing = previous.get(id);
      if (
        existing &&
        existing.source === source &&
        existing.target === target
      ) {
        previous.delete(id);
        next.push(existing);
        continue;
      }

      if (existing) {
        void unmount(existing.component);
        previous.delete(id);
      }

      next.push({
        id,
        source,
        target,
        component: mount(MermaidDiagram, { target, props: { source } }),
      });
    }

    for (const stale of previous.values()) void unmount(stale.component);
    mounted = next;
  }

  function refresh(): void {
    const current = ++generation;
    void tick().then(() => {
      if (current === generation && !destroyed) mountAll();
    });
  }

  refresh();

  return {
    update(next: types.MermaidSource[]): void {
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
