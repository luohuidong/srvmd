import { describe, expect, test } from "vitest";
import { isPageAffected, isStylesheet } from "./live.ts";

describe("isPageAffected", () => {
  test("matches the exact document file", () => {
    expect(isPageAffected("/docs/guide.md", ["docs/guide.md"])).toBe(true);
    expect(isPageAffected("/docs/guide.html", ["docs/guide.html"])).toBe(true);
    expect(isPageAffected("/docs/guide.md", ["other/guide.markdown"])).toBe(
      false,
    );
  });

  test("treats files below a directory page as relevant", () => {
    expect(isPageAffected("/docs/", ["docs/index.md"])).toBe(true);
    expect(isPageAffected("/docs/", ["docs/a.md"])).toBe(true);
    expect(isPageAffected("/docs/", ["docs/sub/a.md"])).toBe(true);
    expect(isPageAffected("/", ["README.md"])).toBe(true);
  });

  test("reacts to Markdown files in the current document's directory", () => {
    expect(isPageAffected("/docs/guide.md", ["docs/other.md"])).toBe(true);
    expect(isPageAffected("/Docs/guide.md", ["docs/Other.MD"])).toBe(true);
    expect(isPageAffected("/docs/guide.md", ["docs/other.txt"])).toBe(false);
    expect(isPageAffected("/docs/guide.md", ["docs/sub/other.md"])).toBe(false);
  });

  test("ignores documents in other directories", () => {
    expect(isPageAffected("/docs/guide.md", ["docs/guide/index.md"])).toBe(
      false,
    );
    expect(isPageAffected("/docs/", ["other/a.md"])).toBe(false);
  });

  test("matches directory events against listings and their own page", () => {
    expect(isPageAffected("/docs/", ["docs/new"])).toBe(true);
    expect(isPageAffected("/docs/new/", ["docs/new"])).toBe(true);
    expect(isPageAffected("/docs/new/", ["docs/new/a.md"])).toBe(true);
    expect(isPageAffected("/", ["docs/new"])).toBe(true);
    expect(isPageAffected("/docs/guide.md", ["docs/new"])).toBe(false);
  });

  test("folds case like a case-insensitive filesystem", () => {
    expect(isPageAffected("/Guide.md", ["guide.md"])).toBe(true);
    expect(isPageAffected("/Guide.html", ["guide.html"])).toBe(true);
    expect(isPageAffected("/Docs/", ["docs/a.md"])).toBe(true);
  });

  test("reloads for stylesheets and empty change sets", () => {
    expect(isPageAffected("/docs/guide.md", ["style.css"])).toBe(true);
    expect(isPageAffected("/docs/guide.md", [])).toBe(true);
  });

  test("decodes URL-encoded path segments", () => {
    expect(isPageAffected("/my%20docs/guide.md", ["my docs/guide.md"])).toBe(
      true,
    );
  });
});

describe("isStylesheet", () => {
  test("recognizes stylesheets regardless of case", () => {
    expect(isStylesheet("css/site.css")).toBe(true);
    expect(isStylesheet("SITE.CSS")).toBe(true);
    expect(isStylesheet("docs/guide.md")).toBe(false);
  });
});
