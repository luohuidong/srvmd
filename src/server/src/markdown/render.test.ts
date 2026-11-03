import type { Highlighter } from "shiki";
import { describe, expect, test } from "vitest";
import { parseFrontmatter } from "./frontmatter.js";
import { createHighlighterService } from "./highlight.js";
import { createRenderer, type RenderedDocument } from "./render.js";

// These assertions pin the HTML contract the Svelte client styles: heading ids
// and anchors, shiki blocks and Mermaid slots. The HTML now comes from our own
// parser rules, so a failure here means a rendering change, not a runtime
// upgrade.

let highlighterPromise: Promise<Highlighter | null> | undefined;

/**
 * Render through the production pipeline. Tests that assert shiki output leave
 * `highlighter` unset and share one instance; the rest opt out with `null`.
 */
async function render(
  source: string,
  options: { highlighter?: Highlighter | null } = {},
): Promise<RenderedDocument> {
  let highlighter = options.highlighter;
  if (highlighter === undefined) {
    highlighterPromise ??= createHighlighterService();
    highlighter = await highlighterPromise;
  }
  return createRenderer({ highlighter }).render(source);
}

describe("parseFrontmatter", () => {
  test("splits YAML frontmatter from the body", () => {
    const result = parseFrontmatter(
      "---\ntitle: Hello\ntags: [a, b]\n---\n\n# Body\n",
    );
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

describe("GFM rendering", () => {
  test("renders tables, strikethrough and task lists", async () => {
    const document = await render(
      "| a | b |\n| - | - |\n| 1 | 2 |\n\n~~gone~~\n\n- [x] done\n- [ ] todo\n",
      { highlighter: null },
    );

    expect(document.html).toContain("<table>");
    // markdown-it renders GFM strikethrough as <s>; browsers style it the same.
    expect(document.html).toContain("<s>gone</s>");
    expect(document.html).toContain('class="task-list-item"');
    expect(document.html).toContain(
      'class="task-list-item-checkbox" type="checkbox" disabled checked',
    );
    expect(document.html).toContain(
      'class="task-list-item-checkbox" type="checkbox" disabled>',
    );
  });

  test("does not treat a marker outside a list item as a task", async () => {
    const document = await render("[x] plain text\n", {
      highlighter: null,
    });
    expect(document.html).toBe("<p>[x] plain text</p>\n");
  });

  test("keeps inline markup after the task marker", async () => {
    const document = await render("- [x] **bold** and `code`\n", {
      highlighter: null,
    });

    expect(document.html).toContain(
      "<strong>bold</strong> and <code>code</code>",
    );
    expect(document.html).not.toContain("**bold**");
    expect(document.html).not.toContain("`code`");
  });

  test("keeps links after the task marker", async () => {
    const document = await render("- [x] https://example.com\n", {
      highlighter: null,
    });

    expect(document.html).toContain(
      '<a href="https://example.com">https://example.com</a>',
    );
  });

  test("marks the list that owns each task item", async () => {
    const document = await render("- a\n  - [ ] nested\n- [ ] outer\n", {
      highlighter: null,
    });

    expect(document.html).toContain(
      '<ul class="contains-task-list">\n<li>a\n<ul class="contains-task-list">',
    );
    expect(document.html).not.toContain(
      "contains-task-list contains-task-list",
    );
  });

  test("leaves lists without task items unclassed", async () => {
    const document = await render("- a\n- b\n", { highlighter: null });
    expect(document.html).toBe("<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n");
  });

  test("linkifies URLs and emails without touching filenames", async () => {
    const document = await render(
      "See https://example.com, www.example.com, hi@example.com and README.md\n",
      { highlighter: null },
    );

    expect(document.html).toContain('<a href="https://example.com">');
    expect(document.html).toContain('<a href="mailto:hi@example.com">');
    expect(document.html).not.toContain("http://www.example.com");
    expect(document.html).not.toContain('<a href="http://README.md">');
  });

  test("renders raw HTML as-is", async () => {
    const document = await render(
      "<script>alert(1)</script>\n\n<details><summary>More</summary>text</details>\n\nhello <b>world</b>\n",
      { highlighter: null },
    );
    expect(document.html).toContain("<script>alert(1)</script>");
    expect(document.html).toContain("<details>");
    expect(document.html).toContain("<b>world</b>");
  });

  test("keeps dollar signs as text", async () => {
    const document = await render("The price is $5 and the path is $HOME.\n", {
      highlighter: null,
    });
    expect(document.html).toContain("$5");
    expect(document.html).toContain("$HOME");
  });
});

describe("headings", () => {
  test("collects the TOC and adds ids with anchors", async () => {
    const document = await render(
      "# Top\n\n## First\n\n### Nested\n\n## Second\n",
      { highlighter: null },
    );

    expect(document.toc.map(item => [item.level, item.id, item.text])).toEqual([
      [1, "top", "Top"],
      [2, "first", "First"],
      [3, "nested", "Nested"],
      [2, "second", "Second"],
    ]);
    expect(document.html).toContain(
      '<h2 id="first" class="heading"><a class="heading-anchor" href="#first" aria-hidden="true">#</a>First</h2>',
    );
  });

  test("strips inline markup from heading text", async () => {
    const document = await render(
      "## Hello `world` and [link](https://example.com)\n",
      { highlighter: null },
    );
    expect(document.toc[0]?.text).toBe("Hello world and link");
  });

  test("keeps inline HTML in heading text", async () => {
    const document = await render("## Press <kbd>Ctrl</kbd> to stop\n", {
      highlighter: null,
    });
    expect(document.toc[0]).toMatchObject({
      id: "press-ctrl-to-stop",
      text: "Press Ctrl to stop",
    });
  });

  test("collapses whitespace left by inline HTML", async () => {
    const document = await render("## Hello <!-- note --> world\n", {
      highlighter: null,
    });
    expect(document.toc[0]).toMatchObject({
      id: "hello-world",
      text: "Hello world",
    });
  });

  test("keeps non-ASCII heading ids addressable", async () => {
    const document = await render("# 中文\n\n# 日本語\n", {
      highlighter: null,
    });
    expect(document.toc.map(item => item.id)).toEqual(["中文", "日本語"]);
    expect(document.html).toContain('href="#中文"');
  });

  test("de-duplicates repeated headings", async () => {
    const document = await render("## Setup\n\n## Setup\n\n## Setup\n", {
      highlighter: null,
    });
    expect(document.toc.map(item => item.id)).toEqual([
      "setup",
      "setup-1",
      "setup-2",
    ]);
  });

  test("avoids ids that later headings would reuse", async () => {
    const document = await render("## Setup\n\n## Setup\n\n## Setup 1\n", {
      highlighter: null,
    });
    expect(document.toc.map(item => item.id)).toEqual([
      "setup",
      "setup-1",
      "setup-1-1",
    ]);
  });

  test("falls back to a stable id for punctuation-only headings", async () => {
    const document = await render("## ---\n", { highlighter: null });
    expect(document.toc[0]?.id).toBe("section");
  });

  test("uses the first h1 as the title", async () => {
    const document = await render("# My Title\n\ntext\n", {
      highlighter: null,
    });
    expect(document.title).toBe("My Title");
  });
});

describe("code blocks", () => {
  test("highlights fenced code with shiki", async () => {
    const document = await render("```ts\nconst x: number = 1;\n```\n");
    expect(document.html).toContain('class="shiki');
    expect(document.html).toContain("--shiki-dark");
  });

  test("falls back to plain code for unknown languages", async () => {
    const document = await render("```not-a-real-language\nplain text\n```\n");
    expect(document.html).toContain(
      '<code class="language-not-a-real-language">',
    );
  });

  test("falls back to plain code when no highlighter is available", async () => {
    const document = await render("```ts\nconst x = 1;\n```\n", {
      highlighter: null,
    });
    expect(document.html).toBe(
      '<pre><code class="language-ts">const x = 1;\n</code></pre>\n',
    );
  });

  test("escapes HTML in plain code blocks", async () => {
    const document = await render("```html\n<script>alert(1)</script>\n```\n", {
      highlighter: null,
    });
    expect(document.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("mermaid diagrams", () => {
  test("turns mermaid fences into slots with raw sources", async () => {
    const document = await render(
      '```mermaid\ngraph TD\n  A["x & y"] --> B\n```\n',
      { highlighter: null },
    );

    expect(document.html).toBe(
      '<div class="mermaid-slot" data-mermaid-slot="mermaid-1"></div>\n',
    );
    expect(document.mermaid).toEqual([
      { id: "mermaid-1", source: 'graph TD\n  A["x & y"] --> B\n' },
    ]);
  });

  test("numbers diagrams in document order", async () => {
    const document = await render(
      "```mermaid\nA --> B\n```\n\ntext\n\n```mermaid\nC --> D\n```\n",
      { highlighter: null },
    );
    expect(document.mermaid.map(item => item.id)).toEqual([
      "mermaid-1",
      "mermaid-2",
    ]);
  });

  test("keeps mermaid fences out of shiki", async () => {
    const document = await render("```mermaid\ngraph TD\n  A --> B\n```\n");
    expect(document.mermaid).toHaveLength(1);
    expect(document.html).toContain('data-mermaid-slot="mermaid-1"');
    expect(document.html).not.toContain("shiki");
  });

  test("reports no diagrams for regular documents", async () => {
    const document = await render("# Plain\n\ntext\n", {
      highlighter: null,
    });
    expect(document.mermaid).toHaveLength(0);
  });
});
