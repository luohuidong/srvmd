import { describe, expect, test } from "vitest";
import { createFixture } from "../../test/fixture.js";
import { listDirectory } from "./directories.js";

describe("listDirectory", () => {
  test("sorts directories first and hides ignored entries", async () => {
    const root = await createFixture();
    const entries = await listDirectory(root, root);
    expect(entries.map(entry => entry.name)).toEqual(["sub", "a.md"]);
    expect(entries[0]?.kind).toBe("dir");
    expect(entries[1]?.kind).toBe("markdown");
  });

  test("reports regular files and their size", async () => {
    const root = await createFixture();
    const entries = await listDirectory(root, `${root}/sub`);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ name: "b.txt", kind: "file", size: 1 });
  });
});
