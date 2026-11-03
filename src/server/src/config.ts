import fsp from "node:fs/promises";
import path from "node:path";
import pkg from "../../../package.json" with { type: "json" };

/**
 * Where the browser UI comes from. The CLI chooses a dev server URL explicitly
 * or falls back to the prebuilt `dist/web` directory.
 */
export type WebSource =
  | { kind: "dist"; root: string }
  | { kind: "dev"; url: string };

/** Normalized web source used by the runtime. */
export type ResolvedWebSource =
  | { kind: "dist"; root: string }
  | { kind: "dev"; url: URL };

/**
 * Fully specified options accepted by `startServer`. Every field is required;
 * the CLI applies the user-facing defaults before calling the server.
 */
export type ServerOptions = {
  /** Directory to serve; relative paths resolve against the process cwd. */
  root: string;
  /** Listening port. Use 0 for a random free port, which the CLI defaults to. */
  port: number;
  /** Extra directory/file names the watcher should ignore. */
  ignore: string[];
  /** Browser UI source: a Vite dev server or the prebuilt assets. */
  web: WebSource;
};

export type ResolvedConfig = {
  /** Absolute path of the served directory, with symlinks resolved. */
  root: string;
  port: number;
  ignore: string[];
  web: ResolvedWebSource;
  version: string;
};

function resolveWebSource(web: WebSource): ResolvedWebSource {
  if (web.kind === "dist") {
    return { kind: "dist", root: path.resolve(web.root) };
  }

  let url: URL;
  try {
    url = new URL(web.url);
  } catch {
    throw new Error(`Invalid web dev server URL: ${web.url}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `Invalid web dev server URL: ${web.url} (expected http or https)`,
    );
  }

  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw new Error(
      `Invalid web dev server URL: ${web.url} (expected an origin such as http://localhost:5180)`,
    );
  }

  return { kind: "dev", url };
}

/** Validate and normalize the fully specified options into a resolved config. */
export async function resolveConfig(
  options: ServerOptions,
): Promise<ResolvedConfig> {
  const requestedRoot = path.resolve(options.root);
  const root = await fsp.realpath(requestedRoot).catch(() => null);
  if (!root) throw new Error(`Directory not found: ${requestedRoot}`);

  const info = await fsp.stat(root);
  if (!info.isDirectory()) throw new Error(`Not a directory: ${requestedRoot}`);

  return {
    root,
    port: options.port,
    ignore: options.ignore,
    web: resolveWebSource(options.web),
    version: pkg.version,
  };
}
