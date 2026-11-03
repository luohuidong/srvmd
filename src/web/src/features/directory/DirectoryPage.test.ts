import type { contracts } from "@shared";
import { render } from "@testing-library/svelte";
import { describe, expect, test } from "vitest";
import DirectoryPage from "./DirectoryPage.svelte";

const page: contracts.DirectoryPayload = {
  kind: "directory",
  heading: "Index of /guide/",
  parentHref: "../",
  entries: [
    { name: "sub", kind: "dir" },
    {
      name: "a.md",
      kind: "markdown",
      size: 12,
      mtime: "2026-01-02T03:04:00.000Z",
    },
    {
      name: "b.txt",
      kind: "file",
      size: 2048,
      mtime: "2026-01-02T03:04:00.000Z",
    },
  ],
  breadcrumbs: [
    { label: "Home", href: "/" },
    { label: "guide", href: "/guide/" },
  ],
};

describe("DirectoryPage", () => {
  test("renders parent link, entries, raw links and metadata", () => {
    const { container } = render(DirectoryPage, { props: { page } });

    expect(container.querySelector(".listing h1")?.textContent).toBe(
      "Index of /guide/",
    );
    expect(container.querySelector('a[href="../"]')).not.toBeNull();
    expect(container.querySelector('a[href="sub/"]')).not.toBeNull();
    expect(container.querySelector('a[href="a.md"]')).not.toBeNull();
    expect(container.querySelector('a[href="a.md?raw"]')).not.toBeNull();
    expect(container.querySelector('a[href="b.txt"]')).not.toBeNull();
    expect(container.textContent).toContain("12 B · 2026-01-02 03:04");
    expect(container.textContent).toContain("2.0 KB · 2026-01-02 03:04");
  });

  test("renders an empty state for a directory without entries", () => {
    const empty: contracts.DirectoryPayload = {
      kind: "directory",
      heading: "Index of /",
      entries: [],
      breadcrumbs: [{ label: "Home", href: "/" }],
    };

    const { container } = render(DirectoryPage, { props: { page: empty } });
    expect(container.textContent).toContain("This directory is empty.");
    expect(container.querySelector('a[href="../"]')).toBeNull();
  });
});
