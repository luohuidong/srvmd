import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, onTestFinished, test } from "vitest";
import { resolveConfig } from "./config.js";

async function createRoot(): Promise<string> {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "srvmd-config-"));
  onTestFinished(() => fsp.rm(root, { recursive: true, force: true }));
  return root;
}

describe("resolveConfig", () => {
  test("resolves a dist web root", async () => {
    const config = await resolveConfig({
      root: await createRoot(),
      port: 0,
      ignore: [],
      web: { kind: "dist", root: "relative/dist" },
    });

    expect(config.web).toEqual({
      kind: "dist",
      root: path.resolve("relative/dist"),
    });
  });

  test("normalizes a dev server origin", async () => {
    const config = await resolveConfig({
      root: await createRoot(),
      port: 0,
      ignore: [],
      web: { kind: "dev", url: "http://localhost:5173/" },
    });

    expect(config.web.kind).toBe("dev");
    if (config.web.kind === "dev") {
      expect(config.web.url.origin).toBe("http://localhost:5173");
    }
  });

  test("rejects dev URLs that are not a bare http origin", async () => {
    const root = await createRoot();

    for (const url of [
      "localhost:5173",
      "ftp://localhost:5173",
      "http://localhost:5173/__app/",
      "http://localhost:5173/?x=1",
      "http://localhost:5173/#x",
    ]) {
      await expect(
        resolveConfig({
          root,
          port: 0,
          ignore: [],
          web: { kind: "dev", url },
        }),
      ).rejects.toThrow("Invalid web dev server URL");
    }
  });
});
