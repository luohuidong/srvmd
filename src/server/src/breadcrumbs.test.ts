import { describe, expect, test } from "vitest";
import { buildBreadcrumbs } from "./breadcrumbs.js";

describe("buildBreadcrumbs", () => {
  test("uses Home for the served root", () => {
    expect(buildBreadcrumbs("")).toEqual([{ label: "Home", href: "/" }]);
  });

  test("links every directory segment", () => {
    expect(buildBreadcrumbs("guide/setup")).toEqual([
      { label: "Home", href: "/" },
      { label: "guide", href: "/guide/" },
      { label: "setup", href: "/guide/setup/" },
    ]);
  });

  test("ignores empty segments from leading and trailing slashes", () => {
    expect(buildBreadcrumbs("/guide/")).toEqual([
      { label: "Home", href: "/" },
      { label: "guide", href: "/guide/" },
    ]);
  });

  test("encodes hrefs while keeping labels readable", () => {
    expect(buildBreadcrumbs("a b/文档")).toEqual([
      { label: "Home", href: "/" },
      { label: "a b", href: "/a%20b/" },
      { label: "文档", href: "/a%20b/%E6%96%87%E6%A1%A3/" },
    ]);
  });

  test("appends the current file after its directory", () => {
    expect(
      buildBreadcrumbs("guide", {
        label: "install.md",
        href: "/guide/install.md",
      }),
    ).toEqual([
      { label: "Home", href: "/" },
      { label: "guide", href: "/guide/" },
      { label: "install.md", href: "/guide/install.md" },
    ]);
  });
});
