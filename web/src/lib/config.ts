import { CONFIG_ELEMENT_ID } from "@shared/constants.ts";
import type { AppConfig } from "@shared/contracts.ts";

const FALLBACK: AppConfig = {
  rootLabel: "srvmd",
  version: "0.0.0",
  theme: "auto",
  live: false,
  single: false,
  mermaid: true,
};

function readConfig(): AppConfig {
  if (typeof document === "undefined") return FALLBACK;

  const node = document.getElementById(CONFIG_ELEMENT_ID);
  if (!node?.textContent) return FALLBACK;

  try {
    return { ...FALLBACK, ...(JSON.parse(node.textContent) as Partial<AppConfig>) };
  } catch {
    return FALLBACK;
  }
}

/** Server-injected app config. Read once at module load. */
export const appConfig = readConfig();
