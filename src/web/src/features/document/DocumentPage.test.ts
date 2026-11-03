import type { contracts } from "@shared";
import { render } from "@testing-library/svelte";
import { describe, expect, test } from "vitest";
import DocumentPage from "./DocumentPage.svelte";

const page: contracts.DocumentPayload = {
  kind: "document",
  title: "Guide",
  html: '<h1 id="guide">Guide</h1><p>Hello <strong>world</strong></p>',
  toc: [
    { level: 1, id: "guide", text: "Guide" },
    { level: 2, id: "one", text: "One" },
    { level: 2, id: "two", text: "Two" },
  ],
  siblings: [
    { name: "install.md", href: "/guide/install.md", active: true },
    { name: "setup.md", href: "/guide/setup.md", active: false },
  ],
  mermaid: [],
  breadcrumbs: [
    { label: "Home", href: "/" },
    { label: "guide", href: "/guide/" },
    { label: "install.md", href: "/guide/install.md" },
  ],
  rawHref: "/guide/install.md?raw",
};

describe("DocumentPage", () => {
  test("renders the markdown body, breadcrumbs, raw link and TOC", () => {
    const { container } = render(DocumentPage, { props: { page } });

    expect(container.querySelector(".markdown-body h1")?.textContent).toBe(
      "Guide",
    );
    expect(container.querySelector(".crumbs")?.textContent).toContain("guide");
    expect(container.querySelector(".crumbs")?.textContent).toContain(
      "install.md",
    );
    expect(container.querySelector('a[href="/guide/"]')).not.toBeNull();
    expect(
      container.querySelector('a[href="/guide/install.md?raw"]'),
    ).not.toBeNull();
    expect(container.querySelector(".toc")).not.toBeNull();
    expect(container.querySelectorAll(".toc a")).toHaveLength(2);
    expect(
      container.querySelector(".layout")?.classList.contains("has-right"),
    ).toBe(true);
  });

  test("lists sibling Markdown documents on the left", () => {
    const { container } = render(DocumentPage, { props: { page } });

    const navigation = container.querySelector(
      'nav[aria-label="Markdown files in this directory"]',
    );
    expect(navigation?.textContent).toContain("install.md");
    expect(navigation?.textContent).toContain("setup.md");
    expect(
      navigation
        ?.querySelector('a[href="/guide/install.md"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");
    expect(
      navigation
        ?.querySelector('a[href="/guide/setup.md"]')
        ?.getAttribute("aria-current"),
    ).toBeNull();
    expect(
      container.querySelector(".layout")?.classList.contains("has-left"),
    ).toBe(true);
  });

  test("renders a frontmatter warning", () => {
    const warning = "Invalid frontmatter: bad YAML";
    const { container } = render(DocumentPage, {
      props: { page: { ...page, warning } },
    });

    expect(container.querySelector(".warning")?.textContent).toBe(warning);
  });
});
