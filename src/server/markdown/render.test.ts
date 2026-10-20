import { describe, expect, test } from "bun:test";
import { extractToc, injectHeadingAnchors, parseFrontmatter, renderMarkdown } from "./index.ts";

describe("parseFrontmatter", () => {
  test("splits YAML frontmatter from the body", () => {
    const result = parseFrontmatter("---\ntitle: Hello\ntags: [a, b]\n---\n\n# Body\n");
    expect(result.data).toEqual({ title: "Hello", tags: ["a", "b"] });
    expect(result.body.trim()).toBe("# Body");
    expect(result.error).toBeUndefined();
  });

  test("leaves documents without frontmatter untouched", () => {
    const source = "# Just a heading\n";
    const result = parseFrontmatter(source);
    expect(result.data).toEqual({});
    expect(result.body).toBe(source);
  });

  test("reports invalid YAML instead of throwing", () => {
    const result = parseFrontmatter("---\ntitle: [unclosed\n---\nbody\n");
    expect(result.error).toContain("Invalid frontmatter");
    expect(result.body.trim()).toBe("body");
  });

  test("ignores non-object YAML values", () => {
    const result = parseFrontmatter("---\n- one\n- two\n---\nbody\n");
    expect(result.data).toEqual({});
  });
});

describe("extractToc", () => {
  test("collects heading ids in document order", async () => {
    const document = await renderMarkdown("# Top\n\n## First\n\n### Nested\n\n## Second\n", { highlight: false });
    expect(document.toc.map(item => [item.level, item.id])).toEqual([
      [1, "top"],
      [2, "first"],
      [3, "nested"],
      [2, "second"],
    ]);
  });

  test("strips inline markup from heading text", () => {
    const toc = extractToc('<h2 id="a">Hello <code>world</code></h2>');
    expect(toc[0]?.text).toBe("Hello world");
  });
});

describe("injectHeadingAnchors", () => {
  test("adds an anchor link to headings with ids", () => {
    const html = injectHeadingAnchors('<h2 id="x">Title</h2>');
    expect(html).toContain('class="heading"');
    expect(html).toContain('href="#x"');
  });

  test("does not touch headings without ids", () => {
    const html = injectHeadingAnchors("<h2>Title</h2>");
    expect(html).toBe("<h2>Title</h2>");
  });
});

describe("renderMarkdown", () => {
  test("uses the frontmatter title and renders GFM", async () => {
    const document = await renderMarkdown(
      "---\ntitle: From YAML\n---\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n~~gone~~\n\n- [x] done\n",
      { highlight: false },
    );
    expect(document.title).toBe("From YAML");
    expect(document.html).toContain("<table>");
    expect(document.html).toContain("<del>gone</del>");
    expect(document.html).toContain("task-list-item");
  });

  test("falls back to the first h1 for the title", async () => {
    const document = await renderMarkdown("# My Title\n\ntext\n", { highlight: false });
    expect(document.title).toBe("My Title");
  });

  test("filters dangerous HTML by default", async () => {
    const document = await renderMarkdown("<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n", {
      highlight: false,
    });
    expect(document.html).not.toContain("<script>");
    expect(document.html).toContain("&lt;script>");
  });

  test("keeps raw HTML when allowed", async () => {
    const document = await renderMarkdown("<details><summary>More</summary>text</details>\n", {
      highlight: false,
      html: "allow",
    });
    expect(document.html).toContain("<details>");
  });

  test("removes raw HTML entirely when html=off", async () => {
    const document = await renderMarkdown("hello <b>world</b>\n\n<div>block</div>\n", {
      highlight: false,
      html: "off",
    });
    expect(document.html).not.toContain("<b>");
    expect(document.html).not.toContain("<div>");
    expect(document.html).toContain("hello");
  });

  test("does not treat dollar signs as math by default", async () => {
    const document = await renderMarkdown("The price is $5 and the path is $HOME.\n", { highlight: false });
    expect(document.html).toContain("$5");
    expect(document.html).toContain("$HOME");
  });

  test("highlights fenced code blocks with shiki", async () => {
    const document = await renderMarkdown("```ts\nconst x: number = 1;\n```\n", { highlight: true });
    expect(document.html).toContain('class="shiki');
    expect(document.html).toContain("--shiki-dark");
  });

  test("falls back to plain code for unknown languages", async () => {
    const document = await renderMarkdown("```not-a-real-language\nplain text\n```\n", { highlight: true });
    expect(document.html).toContain('<code class="language-not-a-real-language">');
  });

  test("keeps code unhighlighted when highlighting is disabled", async () => {
    const document = await renderMarkdown("```ts\nconst x = 1;\n```\n", { highlight: false });
    expect(document.html).toContain('<pre><code class="language-ts">');
    expect(document.html).not.toContain("shiki");
  });
});

describe("mermaid diagrams", () => {
  test("turns mermaid fences into slots with sources", async () => {
    const document = await renderMarkdown("```mermaid\ngraph TD\n  A --> B\n```\n", { highlight: false });
    expect(document.mermaid).toHaveLength(1);
    expect(document.mermaid[0]?.source).toContain("A --> B");
    expect(document.html).toContain('data-mermaid-slot="mermaid-1"');
    expect(document.html).not.toContain('<code class="language-mermaid">');
  });

  test("keeps mermaid fences out of shiki", async () => {
    const document = await renderMarkdown("```mermaid\ngraph TD\n  A --> B\n```\n", { highlight: true });
    expect(document.mermaid).toHaveLength(1);
    expect(document.html).toContain('data-mermaid-slot="mermaid-1"');
    expect(document.html).not.toContain("shiki");
  });

  test("leaves mermaid fences as plain code when disabled", async () => {
    const document = await renderMarkdown("```mermaid\ngraph TD\n```\n", { highlight: false, mermaid: false });
    expect(document.mermaid).toHaveLength(0);
    expect(document.html).toContain('<pre><code class="language-mermaid">');
    expect(document.html).not.toContain("mermaid-slot");
  });

  test("reports no diagrams for regular documents", async () => {
    const document = await renderMarkdown("# Plain\n\ntext\n", { highlight: false });
    expect(document.mermaid).toHaveLength(0);
  });
});
