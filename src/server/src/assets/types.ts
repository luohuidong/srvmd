/**
 * Server-facing view of the browser UI assets. The dist implementation reads
 * `dist/web`; the dev implementation proxies to the Vite dev server.
 */
export type WebAssets = {
  /** Shell HTML, or null when the build is missing or the dev server is down. */
  readShell(): Promise<string | null>;
  /** Serve a `/__app/*` request. */
  respondAsset(url: URL, request: Request): Promise<Response>;
  /** Live-reload entry injected into user static HTML. */
  liveStaticPath: string;
  /** 503 body when the shell cannot be read. */
  unavailableMessage: string;
};
