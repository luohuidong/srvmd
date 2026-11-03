import type { Highlighter } from "shiki";
import { describe, expect, test } from "vitest";
import { highlightCode } from "./highlight.js";

function fakeHighlighter(options: { fail?: boolean } = {}) {
  const calls: { language: string; code: string }[] = [];
  const highlighter = {
    codeToHtml(code: string, renderOptions: { lang: string }) {
      if (options.fail) throw new Error("unknown language");
      calls.push({ language: renderOptions.lang, code });
      return `<pre data-lang="${renderOptions.lang}">${code}</pre>`;
    },
  } as unknown as Highlighter;

  return { highlighter, calls };
}

describe("highlightCode", () => {
  test("drops the trailing fence newline before highlighting", () => {
    const { highlighter, calls } = fakeHighlighter();

    highlightCode(highlighter, "ts", "const x = 1;\n");

    expect(calls[0]).toEqual({ language: "ts", code: "const x = 1;" });
  });

  test("reuses output for identical code blocks and languages", () => {
    const { highlighter, calls } = fakeHighlighter();

    const first = highlightCode(highlighter, "ts", "const x = 1;\n");
    const second = highlightCode(highlighter, "ts", "const x = 1;\n");

    expect(second).toBe(first);
    expect(calls).toHaveLength(1);
  });

  test("distinguishes language and code changes", () => {
    const { highlighter, calls } = fakeHighlighter();

    highlightCode(highlighter, "ts", "const x = 1;\n");
    highlightCode(highlighter, "js", "const x = 1;\n");
    highlightCode(highlighter, "ts", "const x = 2;\n");

    expect(calls).toHaveLength(3);
  });

  test("keeps caches separate for different highlighters", () => {
    const first = fakeHighlighter();
    const second = fakeHighlighter();

    highlightCode(first.highlighter, "ts", "const x = 1;\n");
    highlightCode(second.highlighter, "ts", "const x = 1;\n");

    expect(first.calls).toHaveLength(1);
    expect(second.calls).toHaveLength(1);
  });

  test("returns undefined when the language is unknown", () => {
    const { highlighter } = fakeHighlighter({ fail: true });

    expect(highlightCode(highlighter, "nope", "text\n")).toBeUndefined();
  });
});
