import { describe, expect, test } from "bun:test";
import { createFixture } from "../../../test/fixture.ts";
import { listDirectory } from "./directories.ts";

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
    const entries = await listDirectory(`${root}/sub`, root);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ name: "b.txt", kind: "file", size: 1 });
  });
});
