import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WATCH_MAX_WAIT_MS } from "../../constants.ts";
import { createWatcher } from "./watcher.ts";

async function waitFor(condition: () => boolean, timeout = 3000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error("Timed out waiting for a watcher event");
    await Bun.sleep(10);
  }
}

describe("createWatcher", () => {
  test("flushes periodically during a continuous write stream", async () => {
    const directory = await mkdtemp(join(tmpdir(), "srvmd-watcher-"));
    const file = join(directory, "doc.md");
    await writeFile(file, "start");

    let calls = 0;
    const watcher = await createWatcher({
      root: directory,
      onChange: () => {
        calls++;
      },
    });

    try {
      const end = Date.now() + WATCH_MAX_WAIT_MS + 200;
      while (Date.now() < end) {
        await writeFile(file, `# update ${Date.now()}\n`);
        await Bun.sleep(30);
      }

      // A pure trailing debounce would still be at 0 until the writes stop.
      expect(calls).toBeGreaterThan(0);
    } finally {
      watcher.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("reports a created directory so listings refresh", async () => {
    const directory = await mkdtemp(join(tmpdir(), "srvmd-watcher-"));
    const changes: string[][] = [];
    const watcher = await createWatcher({
      root: directory,
      onChange: files => changes.push(files),
    });

    try {
      const created = join(directory, "newdir");
      await mkdir(created);
      await waitFor(() => changes.flat().includes(created));
    } finally {
      watcher.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("reports a removed directory so listings refresh", async () => {
    const directory = await mkdtemp(join(tmpdir(), "srvmd-watcher-"));
    const removed = join(directory, "olddir");
    await mkdir(removed);

    const changes: string[][] = [];
    const watcher = await createWatcher({
      root: directory,
      onChange: files => changes.push(files),
    });

    try {
      await rm(removed, { recursive: true });
      await waitFor(() => changes.flat().includes(removed));
    } finally {
      watcher.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
