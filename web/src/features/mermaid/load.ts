import { MERMAID_RUNTIME_PATH } from "@shared/constants.ts";

export type MermaidRenderResult = {
  svg: string;
  bindFunctions?: (element: Element) => void;
};

export type MermaidApi = {
  initialize(config: Record<string, unknown>): void;
  render(id: string, source: string): Promise<MermaidRenderResult>;
};

let pending: Promise<MermaidApi> | null = null;

function existing(): MermaidApi | undefined {
  return (globalThis as typeof globalThis & { mermaid?: MermaidApi }).mermaid;
}

/** Load the prebuilt Mermaid runtime from the server, once. */
export function loadMermaid(): Promise<MermaidApi> {
  const current = existing();
  if (current) return Promise.resolve(current);

  pending ??= new Promise<MermaidApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MERMAID_RUNTIME_PATH;
    script.async = true;
    script.addEventListener("load", () => {
      const api = existing();
      if (api) resolve(api);
      else reject(new Error("Mermaid did not initialize."));
    });
    script.addEventListener("error", () => reject(new Error("Failed to load the Mermaid bundle.")));
    document.head.appendChild(script);
  }).catch(error => {
    pending = null;
    throw error;
  });

  return pending;
}
