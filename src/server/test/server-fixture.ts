import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const SHELL = `<!doctype html><html><head><meta name="generator" content="srvmd" /></head><body><div id="app"></div></body></html>`;

export type ServerFixture = {
  root: string;
  webRoot: string;
  seed(
    relativePath: string,
    contents: string,
    directory?: string,
  ): Promise<void>;
  cleanup(): Promise<void>;
};

/** Create a temp content root plus a minimal built Svelte shell for integration tests. */
export async function createServerFixture(
  prefix = "serve-md-",
): Promise<ServerFixture> {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), `${prefix}root-`));
  const webRoot = await fsp.mkdtemp(path.join(os.tmpdir(), `${prefix}web-`));

  async function seed(
    relativePath: string,
    contents: string,
    directory = root,
  ): Promise<void> {
    const target = path.join(directory, relativePath);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, contents);
  }

  await seed("index.html", SHELL, webRoot);
  await seed("assets/app.js", "console.log('app');", webRoot);
  await seed("live-static.js", "console.log('live');", webRoot);

  return {
    root,
    webRoot,
    seed,
    async cleanup() {
      await Promise.all([
        fsp.rm(root, { recursive: true, force: true }),
        fsp.rm(webRoot, { recursive: true, force: true }),
      ]);
    },
  };
}
