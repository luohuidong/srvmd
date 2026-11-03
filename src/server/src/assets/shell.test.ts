import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, onTestFinished, test } from "vitest";
import { createShellCache } from "./shell.js";

async function createWebRoot(): Promise<string> {
  const webRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "srvmd-shell-"));
  onTestFinished(() => fsp.rm(webRoot, { recursive: true, force: true }));
  return webRoot;
}

describe("createShellCache", () => {
  test("returns null when the build is missing", async () => {
    const cache = createShellCache(await createWebRoot());

    await expect(cache.read()).resolves.toBeNull();
  });

  test("caches by mtime and picks up a rebuilt shell", async () => {
    const webRoot = await createWebRoot();
    const file = path.join(webRoot, "index.html");
    await fsp.writeFile(file, "one");

    const cache = createShellCache(webRoot);
    await expect(cache.read()).resolves.toBe("one");
    await expect(cache.read()).resolves.toBe("one");

    await fsp.writeFile(file, "two");
    await fsp.utimes(file, new Date(), new Date(Date.now() + 1000));
    await expect(cache.read()).resolves.toBe("two");
  });
});
