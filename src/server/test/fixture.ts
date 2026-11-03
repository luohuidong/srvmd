import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { onTestFinished } from "vitest";

/**
 * A small directory tree used by the resolver and listing tests.
 *
 * Must be called from inside a test: cleanup is registered with
 * `onTestFinished`, which is not bound to a test when used from `beforeAll`.
 */
export async function createFixture(prefix = "serve-md-"): Promise<string> {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), prefix));
  onTestFinished(() => fsp.rm(root, { recursive: true, force: true }));

  await fsp.mkdir(path.join(root, "sub"), { recursive: true });
  await fsp.mkdir(path.join(root, "node_modules"), { recursive: true });
  await fsp.writeFile(path.join(root, "a.md"), "# A\n");
  await fsp.writeFile(path.join(root, "sub", "b.txt"), "b");
  await fsp.writeFile(path.join(root, "node_modules", "c.js"), "c");
  await fsp.writeFile(path.join(root, ".hidden.md"), "hidden");
  return root;
}
