import { createLiveHub, type LiveHub } from "./hub.ts";
import { createWatcher } from "./watcher.ts";

export type LiveReload = LiveHub;

export type LiveReloadOptions = {
  root: string;
  ignore?: string[];
  onChange?: (files: string[]) => void;
};

/** Compose the filesystem watcher with the WebSocket hub. */
export async function createLiveReload(options: LiveReloadOptions): Promise<LiveReload> {
  const hub = createLiveHub();
  const watcher = await createWatcher({
    root: options.root,
    ignore: options.ignore,
    onChange(files) {
      options.onChange?.(files);
      hub.broadcast(files);
    },
  });

  return {
    ...hub,
    closeAll() {
      watcher.close();
      hub.closeAll();
    },
  };
}

export { injectLiveReload, LIVE_CLIENT_SCRIPT_PATH } from "./client-script.ts";
