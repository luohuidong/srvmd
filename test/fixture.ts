import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A small directory tree used by the resolver and listing tests. */
export async function createFixture(prefix = "serve-md-"): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  await mkdir(join(root, "sub"), { recursive: true });
  await mkdir(join(root, "node_modules"), { recursive: true });
  await writeFile(join(root, "a.md"), "# A\n");
  await writeFile(join(root, "sub", "b.txt"), "b");
  await writeFile(join(root, "node_modules", "c.js"), "c");
  await writeFile(join(root, ".hidden.md"), "hidden");
  return root;
}
