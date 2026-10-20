import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const SHELL = `<!doctype html><html><head><script id="serve-md-config" type="application/json">"__SERVE_MD_CONFIG__"</script></head><body><div id="app"></div></body></html>`;

export type ServerFixture = {
  root: string;
  webRoot: string;
  seed(relativePath: string, contents: string, directory?: string): Promise<void>;
  cleanup(): Promise<void>;
};

/** Create a temp content root plus a minimal built Svelte shell for integration tests. */
export async function createServerFixture(prefix = "serve-md-"): Promise<ServerFixture> {
  const root = await mkdtemp(join(tmpdir(), `${prefix}root-`));
  const webRoot = await mkdtemp(join(tmpdir(), `${prefix}web-`));

  async function seed(relativePath: string, contents: string, directory = root): Promise<void> {
    const target = join(directory, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents);
  }

  await seed("index.html", SHELL, webRoot);
  await seed("assets/app.js", "console.log('app');", webRoot);
  await seed("live-static.js", "console.log('live');", webRoot);

  return {
    root,
    webRoot,
    seed,
    async cleanup() {
      await Promise.all([rm(root, { recursive: true, force: true }), rm(webRoot, { recursive: true, force: true })]);
    },
  };
}
