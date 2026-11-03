import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import type { ServerOptions } from "../../server/src/index.js";

/**
 * Locate the prebuilt web assets that ship with this package.
 *
 * The Vite build writes to `dist/web`, so resolving it relative to the CLI
 * module works for both source tests and the published package.
 */
function resolveWebRoot(): string {
  const webRoot = url.fileURLToPath(
    new URL("../../../dist/web", import.meta.url),
  );
  const entry = path.join(webRoot, "index.html");

  if (!fs.existsSync(entry))
    throw new Error(`web assets are missing at ${entry}`);

  return webRoot;
}

/**
 * Prefer an explicit dev server URL; otherwise use the built assets.
 *
 * The development entry point sets `SRVMD_DEV_WEB_URL`; normal CLI usage never
 * needs a Vite server.
 */
export function resolveWebSource(
  devUrl: string | undefined,
): ServerOptions["web"] {
  if (devUrl) return { kind: "dev", url: devUrl };
  return { kind: "dist", root: resolveWebRoot() };
}
