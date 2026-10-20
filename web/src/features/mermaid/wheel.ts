/** Attach a non-passive wheel listener so the viewer can prevent page scroll. */
export function nonPassiveWheel(node: HTMLElement, handler: (event: WheelEvent) => void) {
  let current = handler;

  const listener = (event: WheelEvent) => current(event);
  node.addEventListener("wheel", listener, { passive: false });

  return {
    update(next: (event: WheelEvent) => void) {
      current = next;
    },
    destroy() {
      node.removeEventListener("wheel", listener);
    },
  };
}
