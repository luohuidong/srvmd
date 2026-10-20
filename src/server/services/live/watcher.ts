import { type Dirent, type FSWatcher, watch } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { IGNORED_NAMES, WATCH_DEBOUNCE_MS, WATCHED_EXTENSIONS } from "../../constants.ts";

export type Watcher = {
  close(): void;
};

export type WatcherOptions = {
  root: string;
  ignore?: string[];
  onChange: (files: string[]) => void;
};

/**
 * Watch every non-ignored directory under root (one inotify watcher per
 * directory) and report debounced file changes.
 *
 * Watching directories individually avoids putting recursive watchers on
 * node_modules/.git, which is expensive and can hit inotify limits.
 */
export async function createWatcher(options: WatcherOptions): Promise<Watcher> {
  const ignored = new Set([...IGNORED_NAMES, ...(options.ignore ?? [])]);
  const watchers = new Map<string, FSWatcher>();
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const shouldIgnore = (name: string) => name.startsWith(".") || ignored.has(name);

  function flush(): void {
    timer = undefined;
    if (pending.size === 0) return;
    const files = [...pending];
    pending.clear();
    options.onChange(files);
  }

  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, WATCH_DEBOUNCE_MS);
  }

  async function addDirectory(directory: string): Promise<void> {
    if (closed || watchers.has(directory)) return;
    let dirents: Dirent[];
    try {
      dirents = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    try {
      const watcher = watch(directory, (event, filename) => {
        if (closed) return;
        const name = filename?.toString();
        if (event === "rename") void reconcile(directory);
        if (!name || shouldIgnore(name) || !WATCHED_EXTENSIONS.test(name)) return;
        pending.add(join(directory, name));
        schedule();
      });
      watcher.on("error", () => {
        watcher.close();
        watchers.delete(directory);
      });
      watchers.set(directory, watcher);
    } catch {
      return;
    }

    for (const dirent of dirents) {
      if (dirent.isDirectory() && !shouldIgnore(dirent.name)) {
        await addDirectory(join(directory, dirent.name));
      }
    }
  }

  function removeWatcherTree(target: string): void {
    for (const [watched, watcher] of [...watchers]) {
      if (watched === target || watched.startsWith(target + sep)) {
        watcher.close();
        watchers.delete(watched);
      }
    }
  }

  /** Add watchers for newly-created dirs and drop watchers for deleted ones. */
  async function reconcile(directory: string): Promise<void> {
    if (closed) return;
    const dirents = await readdir(directory, { withFileTypes: true }).catch(() => null);
    if (!dirents) {
      removeWatcherTree(directory);
      return;
    }

    const childDirs = new Set(
      dirents
        .filter(dirent => dirent.isDirectory() && !shouldIgnore(dirent.name))
        .map(dirent => join(directory, dirent.name)),
    );

    for (const child of childDirs) {
      if (!watchers.has(child)) await addDirectory(child);
    }

    for (const watched of [...watchers.keys()]) {
      if (watched === directory) continue;
      if (dirname(watched) === directory && !childDirs.has(watched)) {
        removeWatcherTree(watched);
      }
    }
  }

  await addDirectory(options.root);

  return {
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      timer = undefined;
      for (const watcher of watchers.values()) watcher.close();
      watchers.clear();
    },
  };
}
