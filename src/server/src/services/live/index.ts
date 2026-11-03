import path from "node:path";
import { createLiveHub, type LiveHub } from "./hub.js";
import { createWatcher } from "./watcher.js";

export type { LiveHub } from "./hub.js";

type LiveReloadOptions = {
  root: string;
  ignore?: string[];
  /** Absolute paths of changed files and directories (directories have no trailing separator). */
  onChange?: (files: string[]) => void;
};

/** Compose the filesystem watcher with the WebSocket hub. */
export async function createLiveReload(
  options: LiveReloadOptions,
): Promise<LiveHub> {
  const hub = createLiveHub();
  const watcher = await createWatcher({
    root: options.root,
    ignore: options.ignore,
    onChange(files) {
      options.onChange?.(files);
      hub.broadcast(
        files.map(file =>
          path.relative(options.root, file).split(path.sep).join("/"),
        ),
      );
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
