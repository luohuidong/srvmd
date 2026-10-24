import { describe, expect, test } from "vitest";
import { isPageAffected, isStylesheet } from "./live.ts";

describe("isPageAffected", () => {
  test("matches a document, its clean URL, and a directory index", () => {
    expect(isPageAffected("/docs/guide.md", ["docs/guide.md"])).toBe(true);
    expect(isPageAffected("/docs/guide", ["docs/guide.md"])).toBe(true);
    expect(isPageAffected("/docs/guide", ["docs/guide/index.md"])).toBe(true);
    expect(isPageAffected("/docs/guide.html", ["docs/guide.html"])).toBe(true);
  });

  test("treats files below a directory page as relevant", () => {
    expect(isPageAffected("/docs/", ["docs/index.md"], "directory")).toBe(true);
    expect(isPageAffected("/docs/", ["docs/a.md"], "directory")).toBe(true);
    expect(isPageAffected("/docs/", ["docs/sub/a.md"], "directory")).toBe(true);
    expect(isPageAffected("/", ["README.md"], "directory")).toBe(true);
  });

  test("keeps a document served at a directory URL focused on its own source", () => {
    expect(isPageAffected("/docs/", ["docs/index.md"], "document")).toBe(true);
    expect(isPageAffected("/docs/", ["docs/other.md"], "document")).toBe(false);
    expect(isPageAffected("/", ["index.md"], "document")).toBe(true);
    expect(isPageAffected("/", ["docs/a.md"], "document")).toBe(false);
  });

  test("assumes a directory page while the payload is unknown", () => {
    expect(isPageAffected("/docs/", ["docs/sub/a.md"])).toBe(true);
    expect(isPageAffected("/", ["README.md"])).toBe(true);
    expect(isPageAffected("/docs/guide", ["docs/other.md"])).toBe(false);
  });

  test("ignores unrelated documents", () => {
    expect(isPageAffected("/docs/guide.md", ["docs/other.md"])).toBe(false);
    expect(isPageAffected("/docs/guide", ["docs/other.md"])).toBe(false);
    expect(isPageAffected("/docs/", ["other/a.md"], "directory")).toBe(false);
  });

  test("matches directory events against listings and their own page", () => {
    expect(isPageAffected("/docs/", ["docs/new"], "directory")).toBe(true);
    expect(isPageAffected("/docs/new/", ["docs/new"], "directory")).toBe(true);
    expect(isPageAffected("/", ["docs/new"], "directory")).toBe(true);
    expect(isPageAffected("/docs/guide", ["docs/new"], "document")).toBe(false);
  });

  test("folds case like a case-insensitive filesystem", () => {
    expect(isPageAffected("/Guide", ["guide.md"])).toBe(true);
    expect(isPageAffected("/Guide.html", ["guide.html"])).toBe(true);
    expect(isPageAffected("/Docs/", ["docs/a.md"], "directory")).toBe(true);
  });

  test("reloads for stylesheets and empty change sets", () => {
    expect(isPageAffected("/docs/guide", ["style.css"], "document")).toBe(true);
    expect(isPageAffected("/docs/guide", [])).toBe(true);
  });

  test("decodes URL-encoded path segments", () => {
    expect(isPageAffected("/my%20docs/guide", ["my docs/guide.md"])).toBe(true);
  });
});

describe("isStylesheet", () => {
  test("recognizes stylesheets regardless of case", () => {
    expect(isStylesheet("css/site.css")).toBe(true);
    expect(isStylesheet("SITE.CSS")).toBe(true);
    expect(isStylesheet("docs/guide.md")).toBe(false);
  });
});
