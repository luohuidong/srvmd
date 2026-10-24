import { describe, expect, test } from "bun:test";
import type { Highlighter } from "shiki";
import { highlightCodeBlocks } from "./highlight.ts";

function fakeHighlighter() {
  let calls = 0;
  const highlighter = {
    codeToHtml(code: string, options: { lang: string }) {
      calls++;
      return `<pre data-lang="${options.lang}">${code}</pre>`;
    },
  } as unknown as Highlighter;

  return { highlighter, calls: () => calls };
}

const HTML = '<pre><code class="language-ts">const x = 1;</code></pre>';

describe("highlightCodeBlocks", () => {
  test("reuses output for identical code blocks and languages", () => {
    const { highlighter, calls } = fakeHighlighter();

    const first = highlightCodeBlocks(HTML, highlighter);
    const second = highlightCodeBlocks(HTML, highlighter);

    expect(second).toBe(first);
    expect(calls()).toBe(1);
  });

  test("distinguishes language and code changes", () => {
    const { highlighter, calls } = fakeHighlighter();

    highlightCodeBlocks(HTML, highlighter);
    highlightCodeBlocks('<pre><code class="language-js">const x = 1;</code></pre>', highlighter);
    highlightCodeBlocks('<pre><code class="language-ts">const x = 2;</code></pre>', highlighter);

    expect(calls()).toBe(3);
  });

  test("keeps caches separate for different highlighters", () => {
    const first = fakeHighlighter();
    const second = fakeHighlighter();

    highlightCodeBlocks(HTML, first.highlighter);
    highlightCodeBlocks(HTML, second.highlighter);

    expect(first.calls()).toBe(1);
    expect(second.calls()).toBe(1);
  });
});
