import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { describe, expect, test } from "vitest";
import { resolveWebSource } from "./web-source.js";

describe("resolveWebSource", () => {
  test("uses the dev server URL when one is provided", () => {
    expect(resolveWebSource("http://localhost:5180")).toEqual({
      kind: "dev",
      url: "http://localhost:5180",
    });
  });

  test("resolves the built web assets", () => {
    const source = resolveWebSource(undefined);

    expect(source.kind).toBe("dist");
    if (source.kind !== "dist") return;

    expect(source.root).toBe(
      url.fileURLToPath(new URL("../../../dist/web", import.meta.url)),
    );
    expect(fs.existsSync(path.join(source.root, "index.html"))).toBe(true);
  });
});
