import type { contracts } from "@shared";
import { render } from "@testing-library/svelte";
import { describe, expect, test, vi } from "vitest";
import DocumentPage from "./DocumentPage.svelte";

vi.mock("../mermaid/render.ts", () => ({
  renderDiagram: vi.fn(async () => ({
    svg: '<svg viewBox="0 0 10 10"><text>diagram</text></svg>',
  })),
}));

const page: contracts.DocumentPayload = {
  kind: "document",
  title: "Diagram",
  html: '<p>before</p><div data-mermaid-slot="mermaid-1"></div><p>after</p>',
  toc: [],
  siblings: [],
  mermaid: [{ id: "mermaid-1", source: "graph TD; A-->B" }],
  breadcrumbs: [{ label: "Home", href: "/" }],
  rawHref: "/diagram?raw",
};

describe("Markdown Mermaid slots", () => {
  test("mounts a Svelte diagram component into the server slot", async () => {
    const { container } = render(DocumentPage, { props: { page } });

    await vi.waitFor(() => {
      expect(container.querySelector(".mermaid-figure")).not.toBeNull();
    });

    expect(container.querySelector(".mermaid-canvas svg")).not.toBeNull();
    expect(
      container
        .querySelector(".mermaid-figure")
        ?.getAttribute("data-mermaid-state"),
    ).toBe("rendered");
    expect(container.textContent).toContain("before");
    expect(container.textContent).toContain("after");
  });
});
