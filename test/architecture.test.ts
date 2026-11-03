import fsp from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");
const CLI_PROJECT = path.join(SRC, "cli");
const SERVER_PROJECT = path.join(SRC, "server");
const SHARED_PROJECT = path.join(SRC, "shared");
const WEB_PROJECT = path.join(SRC, "web");
const CLI = path.join(CLI_PROJECT, "src");
const SERVER = path.join(SERVER_PROJECT, "src");
const SHARED = path.join(SHARED_PROJECT, "src");
const WEB = path.join(WEB_PROJECT, "src");
const WEB_SCRIPTS = path.join(WEB_PROJECT, "scripts");
const SERVER_TEST = path.join(SERVER_PROJECT, "test");
// Covers `from "x"`, `import("x")` and side-effect `import "x"`.
const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+)["']/g;
const NAMED_NODE_IMPORT_RE =
  /import\s+(?:type\s+)?\{[\s\S]*?\}\s*from\s*["']node:/g;

type Runtime = "cli" | "server" | "shared" | "web";

const SOURCE_DIR: Record<Runtime, string> = {
  cli: CLI,
  server: SERVER,
  shared: SHARED,
  web: WEB,
};

const PROJECT_DIR: Record<Runtime, string> = {
  cli: "src/cli/src",
  server: "src/server/src",
  shared: "src/shared/src",
  web: "src/web/src",
};

async function readFile(file: string): Promise<string> {
  return fsp.readFile(file, "utf8");
}

async function exists(file: string): Promise<boolean> {
  return fsp.access(file).then(
    () => true,
    () => false,
  );
}

async function collectFiles(directory: string): Promise<string[]> {
  const dirents = await fsp.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const dirent of dirents) {
    const full = path.join(directory, dirent.name);
    if (dirent.isDirectory()) {
      if (dirent.name === "node_modules" || dirent.name === "dist") continue;
      files.push(...(await collectFiles(full)));
    } else if (
      dirent.isFile() &&
      (dirent.name.endsWith(".ts") || dirent.name.endsWith(".svelte"))
    ) {
      files.push(full);
    }
  }

  return files;
}

function runtimeOf(file: string): Runtime | null {
  for (const runtime of Object.keys(SOURCE_DIR) as Runtime[]) {
    if (file.startsWith(path.join(SOURCE_DIR[runtime], path.sep)))
      return runtime;
  }
  return null;
}

function normalizeTarget(file: string, specifier: string): string | null {
  if (specifier.startsWith(".")) {
    const target = path.resolve(path.dirname(file), specifier);
    // Source imports use `.js` because of NodeNext; compare against `.ts`.
    return target.endsWith(".js")
      ? `${target.slice(0, -".js".length)}.ts`
      : target;
  }

  if (specifier === "@shared") return path.join(SHARED, "index.ts");
  if (specifier.startsWith("@shared/")) {
    return path.join(SHARED, specifier.slice("@shared/".length));
  }

  if (specifier === "$lib" || specifier.startsWith("$lib/")) {
    return path.join(
      WEB,
      "lib",
      specifier.slice("$lib".length).replace(/^\/+/, ""),
    );
  }

  return null;
}

function relativeToRoot(target: string): string {
  return path.relative(ROOT, target).split(path.sep).join("/");
}

function isInsideDirectory(targetPath: string, directory: string): boolean {
  const prefix = `${directory}/`;
  return targetPath === directory || targetPath.startsWith(prefix);
}

// Type-level boundaries are enforced by the per-project tsconfigs: `shared`
// has no ambient types, `shared` and `server` exclude the DOM lib, and only
// `web` maps `@shared`. This scan covers what the compiler cannot see: relative
// imports that resolve across a project boundary, `svelte` from the server,
// `node:*` in the browser bundle, and the published package layout. Loosening a
// project's `lib`, `types` or `paths` moves a check from tsc back to here.
describe("srvmd module boundaries", () => {
  test("cli, server, shared and web respect their boundaries", async () => {
    const violations: string[] = [];
    const files = (
      await Promise.all(
        (Object.keys(SOURCE_DIR) as Runtime[]).map(runtime =>
          collectFiles(SOURCE_DIR[runtime]),
        ),
      )
    )
      .flat()
      .filter(file => !file.endsWith(".test.ts"));

    for (const file of files) {
      const runtime = runtimeOf(file);
      if (!runtime) continue;

      const source = await readFile(file);
      const relativePath = relativeToRoot(file);

      for (const match of source.matchAll(IMPORT_RE)) {
        const specifier = match[1];
        if (!specifier) continue;
        const target = normalizeTarget(file, specifier);
        const targetPath = target ? relativeToRoot(target) : null;
        const insideOwnProject = targetPath
          ? isInsideDirectory(targetPath, PROJECT_DIR[runtime])
          : false;

        if (runtime === "shared") {
          if (targetPath && !insideOwnProject) {
            violations.push(
              `${relativePath}: shared must not import ${targetPath}`,
            );
          }
        }

        if (runtime === "server") {
          const allowed =
            targetPath === "package.json" ||
            insideOwnProject ||
            (targetPath?.startsWith("src/shared/") ?? false);
          if (targetPath && !allowed) {
            violations.push(
              `${relativePath}: server must not import ${targetPath}`,
            );
          }
          if (specifier === "svelte" || specifier.startsWith("svelte/")) {
            violations.push(
              `${relativePath}: server must not use Svelte -> ${specifier}`,
            );
          }
        }

        if (runtime === "web") {
          if (specifier.startsWith("node:")) {
            violations.push(`${relativePath}: web must not use ${specifier}`);
          }
          const allowed =
            insideOwnProject ||
            (targetPath?.startsWith("src/shared/") ?? false);
          if (targetPath && !allowed) {
            violations.push(
              `${relativePath}: web must not import ${targetPath}`,
            );
          }
        }

        if (runtime === "cli") {
          // The CLI owns process concerns and reaches the runtime only through
          // the server root entry, never through internal server modules.
          const allowed =
            targetPath === "package.json" ||
            targetPath === "src/server/src/index.ts" ||
            insideOwnProject;
          if (targetPath && !allowed) {
            violations.push(
              `${relativePath}: cli must not import ${targetPath}`,
            );
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

describe("package layout", () => {
  test("keeps the four modules inside src", async () => {
    const dirents = await fsp.readdir(SRC, { withFileTypes: true });
    const directories = dirents
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .sort();

    expect(directories).toEqual(["cli", "server", "shared", "web"]);
    expect(await exists(path.join(CLI, "index.ts"))).toBe(true);
    expect(await exists(path.join(SERVER, "index.ts"))).toBe(true);
    expect(await exists(path.join(SHARED, "index.ts"))).toBe(true);
    expect(await exists(path.join(WEB, "App.svelte"))).toBe(true);
  });

  test("uses one root package manifest", async () => {
    const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"))) as {
      name?: string;
      bin?: Record<string, string>;
      files?: string[];
      workspaces?: unknown;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(pkg.name).toBe("srvmd");
    expect(pkg.bin?.srvmd).toBe("./dist/cli/src/index.js");
    expect(pkg.files).toContain("dist");
    expect(pkg.workspaces).toBeUndefined();
    expect(await exists(path.join(ROOT, "packages"))).toBe(false);

    // pnpm 12 keeps install settings (allowBuilds) in pnpm-workspace.yaml, so the
    // file may exist; it must not declare workspace members.
    const workspaceFile = path.join(ROOT, "pnpm-workspace.yaml");
    if (await exists(workspaceFile)) {
      const settings = parse(await readFile(workspaceFile)) as {
        packages?: unknown;
      } | null;
      expect(settings?.packages).toBeUndefined();
    }

    const dependencies = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    expect(
      Object.keys(dependencies).filter(name => name.startsWith("@srvmd/")),
    ).toEqual([]);
  });

  test("keeps per-project configuration files", async () => {
    const files = [
      path.join(CLI_PROJECT, "tsconfig.json"),
      path.join(CLI_PROJECT, "tsconfig.build.json"),
      path.join(CLI_PROJECT, "biome.json"),
      path.join(CLI_PROJECT, "vitest.config.ts"),
      path.join(SERVER_PROJECT, "tsconfig.json"),
      path.join(SERVER_PROJECT, "tsconfig.build.json"),
      path.join(SERVER_PROJECT, "biome.json"),
      path.join(SERVER_PROJECT, "vitest.config.ts"),
      path.join(SHARED_PROJECT, "tsconfig.json"),
      path.join(SHARED_PROJECT, "tsconfig.build.json"),
      path.join(SHARED_PROJECT, "biome.json"),
      path.join(WEB_PROJECT, "tsconfig.json"),
      path.join(WEB_PROJECT, "biome.json"),
      path.join(WEB_PROJECT, "vite.config.ts"),
      path.join(WEB_PROJECT, "vitest.config.ts"),
      path.join(WEB_PROJECT, ".prettierrc.json"),
    ];

    expect(await Promise.all(files.map(exists))).toEqual(files.map(() => true));
  });
});

describe("node builtin imports", () => {
  test("load the module object through a default import", async () => {
    const roots = [
      path.join(ROOT, "test"),
      CLI,
      SERVER,
      SHARED,
      WEB,
      WEB_SCRIPTS,
      SERVER_TEST,
    ];
    const files = (await Promise.all(roots.map(collectFiles))).flat();
    const violations: string[] = [];

    for (const file of files) {
      const source = await readFile(file);
      for (const match of source.matchAll(NAMED_NODE_IMPORT_RE)) {
        violations.push(
          `${relativeToRoot(file)}: use a default import, not ${match[0]}`,
        );
      }
    }

    expect(violations).toEqual([]);
  });
});
