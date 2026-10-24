import { tick } from "svelte";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { mermaidSlots } from "./slots.ts";

const mocks = vi.hoisted(() => ({
  renderDiagram: vi.fn(),
}));

vi.mock("./render.ts", () => ({
  renderDiagram: mocks.renderDiagram,
}));

beforeEach(() => {
  mocks.renderDiagram.mockReset();
  mocks.renderDiagram.mockResolvedValue({
    svg: '<svg viewBox="0 0 10 10"><text>diagram</text></svg>',
  });
});

describe("mermaidSlots", () => {
  test("does not rerender an unchanged diagram", async () => {
    const node = document.createElement("div");
    node.innerHTML = '<div data-mermaid-slot="mermaid-1"></div>';

    const action = mermaidSlots(node, [{ id: "mermaid-1", source: "graph TD; A-->B" }]);
    await vi.waitFor(() => {
      expect(mocks.renderDiagram).toHaveBeenCalledTimes(1);
    });

    action.update([{ id: "mermaid-1", source: "graph TD; A-->B" }]);
    await tick();
    await tick();

    expect(mocks.renderDiagram).toHaveBeenCalledTimes(1);
    action.destroy();
  });

  test("rerenders when the diagram source changes", async () => {
    const node = document.createElement("div");
    node.innerHTML = '<div data-mermaid-slot="mermaid-1"></div>';

    const action = mermaidSlots(node, [{ id: "mermaid-1", source: "graph TD; A-->B" }]);
    await vi.waitFor(() => {
      expect(mocks.renderDiagram).toHaveBeenCalledTimes(1);
    });

    action.update([{ id: "mermaid-1", source: "graph TD; A-->C" }]);
    await vi.waitFor(() => {
      expect(mocks.renderDiagram).toHaveBeenCalledTimes(2);
    });

    action.destroy();
  });
});
