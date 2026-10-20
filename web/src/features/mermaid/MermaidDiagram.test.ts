import { fireEvent, render } from "@testing-library/svelte";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { setTheme } from "../theme/theme.svelte.ts";
import MermaidDiagram from "./MermaidDiagram.svelte";
import { closeViewer, viewer } from "./viewer.svelte.ts";

const mocks = vi.hoisted(() => ({
  renderDiagram: vi.fn(),
  bindFunctions: vi.fn(),
}));

vi.mock("./render.ts", () => ({
  renderDiagram: mocks.renderDiagram,
}));

const SOURCE = "graph TD; A-->B";

function rendered() {
  return {
    svg: '<svg viewBox="0 0 100 50"><text>diagram</text></svg>',
    bindFunctions: mocks.bindFunctions,
  };
}

beforeEach(() => {
  mocks.renderDiagram.mockReset();
  mocks.bindFunctions.mockReset();
  mocks.renderDiagram.mockResolvedValue(rendered());
  setTheme("light");
  closeViewer();
});

describe("MermaidDiagram", () => {
  test("shows the source while rendering, then mounts the SVG and bindings", async () => {
    const { container } = render(MermaidDiagram, { props: { source: SOURCE } });
    const figure = container.querySelector(".mermaid-figure");

    expect(figure?.getAttribute("data-mermaid-state")).toBe("pending");
    expect(container.textContent).toContain(SOURCE);

    await vi.waitFor(() => {
      expect(figure?.getAttribute("data-mermaid-state")).toBe("rendered");
    });

    expect(container.querySelector(".mermaid-canvas svg")).not.toBeNull();
    expect(mocks.renderDiagram).toHaveBeenCalledWith(SOURCE, "light");
    expect(mocks.bindFunctions).toHaveBeenCalledWith(expect.any(Element));
  });

  test("opens the viewer on click and keyboard", async () => {
    const { container } = render(MermaidDiagram, { props: { source: SOURCE } });
    const figure = container.querySelector(".mermaid-figure") as HTMLElement;

    await vi.waitFor(() => {
      expect(figure.getAttribute("data-mermaid-state")).toBe("rendered");
    });

    await fireEvent.click(figure);
    expect(viewer.open).toBe(true);
    expect(viewer.source).toBe(SOURCE);

    closeViewer();
    await fireEvent.keyDown(figure, { key: "Enter" });
    expect(viewer.open).toBe(true);

    closeViewer();
    await fireEvent.keyDown(figure, { key: " " });
    expect(viewer.open).toBe(true);
  });

  test("renders an error state and keeps the source visible", async () => {
    mocks.renderDiagram.mockRejectedValueOnce(new Error("bad diagram"));

    const { container } = render(MermaidDiagram, { props: { source: SOURCE } });
    const figure = container.querySelector(".mermaid-figure") as HTMLElement;

    await vi.waitFor(() => {
      expect(figure.getAttribute("data-mermaid-state")).toBe("error");
    });

    expect(container.textContent).toContain("Mermaid error: bad diagram");
    expect(container.textContent).toContain(SOURCE);

    await fireEvent.click(figure);
    expect(viewer.open).toBe(false);
  });

  test("re-renders when the theme changes", async () => {
    const { container } = render(MermaidDiagram, { props: { source: SOURCE } });
    const figure = container.querySelector(".mermaid-figure");

    await vi.waitFor(() => {
      expect(figure?.getAttribute("data-mermaid-state")).toBe("rendered");
    });

    setTheme("dark");

    await vi.waitFor(() => {
      expect(mocks.renderDiagram).toHaveBeenLastCalledWith(SOURCE, "dark");
    });

    expect(figure?.getAttribute("data-mermaid-state")).toBe("rendered");
  });
});
