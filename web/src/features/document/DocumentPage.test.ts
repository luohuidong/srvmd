import type { DocumentPayload } from "@shared/contracts.ts";
import { render } from "@testing-library/svelte";
import { describe, expect, test } from "vitest";
import DocumentPage from "./DocumentPage.svelte";

const page: DocumentPayload = {
  kind: "document",
  path: "/guide",
  title: "Guide",
  html: '<h1 id="guide">Guide</h1><p>Hello <strong>world</strong></p>',
  toc: [
    { level: 1, id: "guide", text: "Guide" },
    { level: 2, id: "one", text: "One" },
    { level: 2, id: "two", text: "Two" },
  ],
  mermaid: [],
  breadcrumbs: [
    { label: "docs", href: "/" },
    { label: "guide", href: "/guide/" },
  ],
  rawHref: "/guide?raw",
};

describe("DocumentPage", () => {
  test("renders the markdown body, breadcrumbs, raw link and TOC", () => {
    const { container } = render(DocumentPage, { props: { page } });

    expect(container.querySelector(".markdown-body h1")?.textContent).toBe("Guide");
    expect(container.querySelector(".crumbs")?.textContent).toContain("guide");
    expect(container.querySelector('a[href="/guide?raw"]')).not.toBeNull();
    expect(container.querySelector(".toc")).not.toBeNull();
    expect(container.querySelectorAll(".toc a")).toHaveLength(2);
    expect(container.querySelector(".layout")?.classList.contains("has-toc")).toBe(true);
  });

  test("renders a frontmatter warning", () => {
    const warning = "Invalid frontmatter: bad YAML";
    const { container } = render(DocumentPage, {
      props: { page: { ...page, warning } },
    });

    expect(container.querySelector(".warning")?.textContent).toBe(warning);
  });
});
