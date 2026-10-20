import { describe, expect, test } from "bun:test";
import { renderMarkdown } from "./render.ts";

describe("mermaid slots", () => {
  test("replaces fences with slots and keeps decoded sources", async () => {
    const document = await renderMarkdown('# Diagram\n\n```mermaid\ngraph TD\n  A["x & y"] --> B\n```\n', {
      highlight: false,
    });

    expect(document.html).toContain('data-mermaid-slot="mermaid-1"');
    expect(document.html).not.toContain("mermaid-figure");
    expect(document.mermaid).toHaveLength(1);
    expect(document.mermaid[0]?.source).toContain('A["x & y"]');
  });

  test("leaves code blocks alone when Mermaid is disabled", async () => {
    const document = await renderMarkdown("```mermaid\ngraph TD\n  A --> B\n```\n", {
      highlight: false,
      mermaid: false,
    });

    expect(document.html).not.toContain("mermaid-slot");
    expect(document.mermaid).toHaveLength(0);
  });
});
