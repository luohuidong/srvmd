import { fireEvent, render } from "@testing-library/svelte";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { setTheme } from "../theme/theme.svelte.ts";
import MermaidViewer from "./MermaidViewer.svelte";
import { closeViewer, openViewer, viewer } from "./viewer.svelte.ts";

const mocks = vi.hoisted(() => ({
  renderDiagram: vi.fn(),
  bindFunctions: vi.fn(),
}));

vi.mock("./render.ts", () => ({
  renderDiagram: mocks.renderDiagram,
}));

const SOURCE = "graph TD; A-->B";
let widthSpy: { mockRestore(): void };
let heightSpy: { mockRestore(): void };

function rendered() {
  return {
    svg: '<svg viewBox="0 0 100 50"><text>diagram</text></svg>',
    bindFunctions: mocks.bindFunctions,
  };
}

function zoomPercent(container: HTMLElement): number {
  const text = container.querySelector(".mermaid-modal-zoom")?.textContent ?? "0%";
  return Number(text.replace("%", ""));
}

beforeEach(() => {
  mocks.renderDiagram.mockReset();
  mocks.bindFunctions.mockReset();
  mocks.renderDiagram.mockResolvedValue(rendered());
  setTheme("light");
  closeViewer();
});

beforeAll(() => {
  widthSpy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
  heightSpy = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(800);
});

afterAll(() => {
  widthSpy.mockRestore();
  heightSpy.mockRestore();
});

describe("MermaidViewer", () => {
  test("opens the dialog, renders the SVG, zooms and closes", async () => {
    const { container } = render(MermaidViewer);
    openViewer(SOURCE);

    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    await vi.waitFor(() => {
      expect(dialog.hasAttribute("open")).toBe(true);
    });
    await vi.waitFor(() => {
      expect(container.querySelector(".mermaid-modal-stage svg")).not.toBeNull();
    });

    expect(viewer.open).toBe(true);
    expect(mocks.renderDiagram).toHaveBeenCalledWith(SOURCE, "light");
    expect(mocks.bindFunctions).toHaveBeenCalledWith(expect.any(Element));

    const initialZoom = zoomPercent(container);
    await fireEvent.click(container.querySelector('button[aria-label="Zoom in"]') as HTMLButtonElement);
    await vi.waitFor(() => {
      expect(zoomPercent(container)).toBeGreaterThan(initialZoom);
    });

    await fireEvent.click(container.querySelector('button[aria-label="Zoom out"]') as HTMLButtonElement);
    await vi.waitFor(() => {
      expect(zoomPercent(container)).toBeLessThanOrEqual(initialZoom);
    });

    await fireEvent.click(container.querySelector('button[aria-label="Fit to window"]') as HTMLButtonElement);
    await vi.waitFor(() => {
      expect(zoomPercent(container)).toBeCloseTo(initialZoom, 0);
    });

    await fireEvent.click(container.querySelector('button[aria-label="Close"]') as HTMLButtonElement);
    await vi.waitFor(() => {
      expect(dialog.hasAttribute("open")).toBe(false);
    });
    expect(viewer.open).toBe(false);
    expect(container.querySelector(".mermaid-modal-stage svg")).toBeNull();
  });

  test("renders an error inside the dialog", async () => {
    mocks.renderDiagram.mockRejectedValueOnce(new Error("bad diagram"));

    const { container } = render(MermaidViewer);
    openViewer(SOURCE);

    await vi.waitFor(() => {
      expect(container.querySelector(".mermaid-modal-error")).not.toBeNull();
    });

    expect(container.querySelector(".mermaid-modal-error")?.textContent).toContain("bad diagram");
    expect(container.querySelector(".mermaid-modal-loading")).toBeNull();
  });
});
