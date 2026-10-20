import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const SRC = join(ROOT, "src");
const WEB = join(ROOT, "web", "src");
const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;

type Runtime = "cli" | "server" | "shared" | "web";

async function collectFiles(directory: string): Promise<string[]> {
  const dirents = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const dirent of dirents) {
    const full = join(directory, dirent.name);
    if (dirent.isDirectory()) {
      if (dirent.name === "node_modules" || dirent.name === "dist") continue;
      files.push(...(await collectFiles(full)));
    } else if (dirent.isFile() && (dirent.name.endsWith(".ts") || dirent.name.endsWith(".svelte"))) {
      files.push(full);
    }
  }

  return files;
}

function runtimeOf(file: string): Runtime | null {
  if (file.startsWith(join(WEB, sep))) return "web";
  if (file.startsWith(join(SRC, "cli", sep))) return "cli";
  if (file.startsWith(join(SRC, "server", sep))) return "server";
  if (file.startsWith(join(SRC, "shared", sep))) return "shared";
  return null;
}

function normalizeTarget(file: string, specifier: string): string | null {
  if (specifier.startsWith(".")) return resolve(dirname(file), specifier);

  if (specifier === "@shared" || specifier.startsWith("@shared/")) {
    return join(SRC, "shared", specifier.slice("@shared".length).replace(/^\/+/, ""));
  }
  if (specifier === "$lib" || specifier.startsWith("$lib/")) {
    return join(WEB, "lib", specifier.slice("$lib".length).replace(/^\/+/, ""));
  }

  return null;
}

function relativeToRoot(target: string): string {
  return relative(ROOT, target).split(sep).join("/");
}

describe("new architecture boundaries", () => {
  test("cli, server, shared and web respect the runtime boundary", async () => {
    const violations: string[] = [];
    const files = [...(await collectFiles(SRC)), ...(await collectFiles(WEB))].filter(
      file => !file.endsWith(".test.ts"),
    );

    for (const file of files) {
      const runtime = runtimeOf(file);
      if (!runtime) continue;

      const source = await Bun.file(file).text();
      const relativePath = relativeToRoot(file);

      for (const match of source.matchAll(IMPORT_RE)) {
        const specifier = match[1];
        if (!specifier) continue;
        const target = normalizeTarget(file, specifier);
        const targetPath = target ? relativeToRoot(target) : null;

        if (runtime === "shared") {
          if (specifier.startsWith("node:") || specifier === "bun" || specifier.startsWith("bun:")) {
            violations.push(`${relativePath}: shared must stay runtime-free -> ${specifier}`);
          }
          if (targetPath && !targetPath.startsWith("src/shared/")) {
            violations.push(`${relativePath}: shared must not import ${targetPath}`);
          }
        }

        if (runtime === "server") {
          if (
            targetPath &&
            targetPath !== "package.json" &&
            !targetPath.startsWith("src/server/") &&
            !targetPath.startsWith("src/shared/")
          ) {
            violations.push(`${relativePath}: server must stay in server/shared -> ${targetPath}`);
          }
          if (specifier === "svelte" || specifier.startsWith("svelte/")) {
            violations.push(`${relativePath}: server must not use Svelte -> ${specifier}`);
          }
        }

        if (runtime === "web") {
          if (specifier.startsWith("node:") || specifier === "bun" || specifier.startsWith("bun:")) {
            violations.push(`${relativePath}: web must not use ${specifier}`);
          }
          if (targetPath?.startsWith("src/") && !targetPath.startsWith("src/shared/")) {
            violations.push(`${relativePath}: web must not import ${targetPath}`);
          }
        }

        if (runtime === "cli" && targetPath) {
          const allowed =
            targetPath === "package.json" ||
            targetPath.startsWith("src/cli/") ||
            targetPath.startsWith("src/server/") ||
            targetPath.startsWith("src/shared/");
          if (!allowed) violations.push(`${relativePath}: cli must not import ${targetPath}`);
        }
      }

      const domGlobals = /\bwindow\.|\bdocument\.(documentElement|querySelector|createElement|body|head)\b/;

      if (runtime === "shared" && (/\bBun\./.test(source) || domGlobals.test(source))) {
        violations.push(`${relativePath}: shared must not touch Bun or the DOM`);
      }
      if (runtime === "web" && /\bBun\./.test(source)) {
        violations.push(`${relativePath}: web must not use Bun`);
      }
      if (runtime === "server" && domGlobals.test(source)) {
        violations.push(`${relativePath}: server must not touch the DOM`);
      }
    }

    expect(violations).toEqual([]);
  });
});
