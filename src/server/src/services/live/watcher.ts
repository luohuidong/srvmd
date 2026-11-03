import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import {
  IGNORED_NAMES,
  WATCH_DEBOUNCE_MS,
  WATCH_MAX_WAIT_MS,
  WATCHED_EXTENSIONS,
} from "../../constants.js";

type Watcher = {
  close(): void;
};

type WatcherOptions = {
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
  const watchers = new Map<string, fs.FSWatcher>();
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;
  let deadline = 0;
  let closed = false;

  const shouldIgnore = (name: string) =>
    name.startsWith(".") || ignored.has(name);

  function flush(): void {
    if (timer) clearTimeout(timer);
    if (maxTimer) clearTimeout(maxTimer);
    timer = undefined;
    maxTimer = undefined;
    if (closed || pending.size === 0) return;
    const changed = [...pending];
    pending.clear();
    options.onChange(changed);
  }

  function schedule(): void {
    if (maxTimer === undefined) {
      deadline = Date.now() + WATCH_MAX_WAIT_MS;
      maxTimer = setTimeout(flush, WATCH_MAX_WAIT_MS);
    }

    if (timer) clearTimeout(timer);
    const remaining = Math.max(0, deadline - Date.now());
    timer = setTimeout(flush, Math.min(WATCH_DEBOUNCE_MS, remaining));
  }

  function enqueue(path: string): void {
    pending.add(path);
    schedule();
  }

  /**
   * `rename` covers create, delete and move without saying which. Watched file
   * extensions are reported directly; anything else is checked against the
   * filesystem so a new directory also refreshes the listings that show it.
   * Deletions are reported from `reconcile`, which still knows the dropped
   * watchers.
   */
  function handleRenameTarget(target: string, name: string): void {
    if (watchers.has(target) || WATCHED_EXTENSIONS.test(name)) {
      enqueue(target);
      return;
    }

    void fsp.stat(target).then(
      info => {
        if (closed || !info.isDirectory()) return;
        enqueue(target);
      },
      () => {
        // Already gone: nothing new to watch or report.
      },
    );
  }

  async function addDirectory(directory: string): Promise<void> {
    if (closed || watchers.has(directory)) return;
    let dirents: fs.Dirent[];
    try {
      dirents = await fsp.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    try {
      const watcher = fs.watch(directory, (event, filename) => {
        if (closed) return;
        const name = filename?.toString();

        if (event === "rename") {
          void reconcile(directory);
          if (!name || shouldIgnore(name)) return;
          handleRenameTarget(path.join(directory, name), name);
          return;
        }

        if (!name || shouldIgnore(name) || !WATCHED_EXTENSIONS.test(name))
          return;
        enqueue(path.join(directory, name));
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
        await addDirectory(path.join(directory, dirent.name));
      }
    }
  }

  function removeWatcherTree(target: string, report = false): void {
    for (const [watched, watcher] of [...watchers]) {
      if (watched === target || watched.startsWith(target + path.sep)) {
        watcher.close();
        watchers.delete(watched);
        if (report) enqueue(watched);
      }
    }
  }

  /** Add watchers for newly-created dirs and drop watchers for deleted ones. */
  async function reconcile(directory: string): Promise<void> {
    if (closed) return;
    const dirents = await fsp
      .readdir(directory, { withFileTypes: true })
      .catch(() => null);
    if (!dirents) {
      removeWatcherTree(directory, true);
      return;
    }

    const childDirs = new Set(
      dirents
        .filter(dirent => dirent.isDirectory() && !shouldIgnore(dirent.name))
        .map(dirent => path.join(directory, dirent.name)),
    );

    for (const child of childDirs) {
      if (!watchers.has(child)) await addDirectory(child);
    }

    for (const watched of [...watchers.keys()]) {
      if (watched === directory) continue;
      if (path.dirname(watched) === directory && !childDirs.has(watched)) {
        removeWatcherTree(watched, true);
      }
    }
  }

  await addDirectory(options.root);

  return {
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      if (maxTimer) clearTimeout(maxTimer);
      timer = undefined;
      maxTimer = undefined;
      for (const watcher of watchers.values()) watcher.close();
      watchers.clear();
    },
  };
}
