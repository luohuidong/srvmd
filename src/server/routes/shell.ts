import { join } from "node:path";
import { CONFIG_TOKEN } from "../../shared/constants.ts";
import type { AppConfig } from "../../shared/contracts.ts";
import type { ResolvedConfig } from "../config.ts";
import { htmlResponse, textResponse } from "../http/respond.ts";

function escapeForScript(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function appConfig(config: ResolvedConfig): AppConfig {
  return {
    rootLabel: config.rootLabel,
    version: config.version,
    theme: config.theme,
    live: config.live,
    single: config.single,
    mermaid: config.mermaid,
  };
}

async function readShell(webRoot: string): Promise<string | null> {
  const file = Bun.file(join(webRoot, "index.html"));
  if (!(await file.exists())) return null;
  return file.text();
}

/**
 * Serve the Svelte shell for an app route. The only server-injected value is a
 * JSON config object; all page structure and content rendering lives in the
 * web app.
 */
export async function respondShell(config: ResolvedConfig, status: number, request: Request): Promise<Response> {
  const template = await readShell(config.webRoot);
  if (!template) {
    return textResponse(
      `srvmd: web build not found at ${join(config.webRoot, "index.html")}.\nRun \`bun run build\` first.`,
      503,
      request.method,
      config.cors,
    );
  }

  const json = escapeForScript(JSON.stringify(appConfig(config)));
  return htmlResponse(template.split(CONFIG_TOKEN).join(json), status, request.method, config.cors);
}
