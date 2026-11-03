import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import timers from "node:timers/promises";
import { describe, expect, test } from "vitest";
import { WATCH_MAX_WAIT_MS } from "../../constants.js";
import { createWatcher } from "./watcher.js";

async function waitFor(
  condition: () => boolean,
  timeout = 3000,
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout)
      throw new Error("Timed out waiting for a watcher event");
    await timers.setTimeout(10);
  }
}

describe("createWatcher", () => {
  test("flushes periodically during a continuous write stream", async () => {
    const directory = await fsp.mkdtemp(
      path.join(os.tmpdir(), "srvmd-watcher-"),
    );
    const file = path.join(directory, "doc.md");
    await fsp.writeFile(file, "start");

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
        await fsp.writeFile(file, `# update ${Date.now()}\n`);
        await timers.setTimeout(30);
      }

      // A pure trailing debounce would still be at 0 until the writes stop.
      expect(calls).toBeGreaterThan(0);
    } finally {
      watcher.close();
      await fsp.rm(directory, { recursive: true, force: true });
    }
  });

  test("reports a created directory so listings refresh", async () => {
    const directory = await fsp.mkdtemp(
      path.join(os.tmpdir(), "srvmd-watcher-"),
    );
    const changes: string[][] = [];
    const watcher = await createWatcher({
      root: directory,
      onChange: files => changes.push(files),
    });

    try {
      const created = path.join(directory, "newdir");
      await fsp.mkdir(created);
      await waitFor(() => changes.flat().includes(created));
    } finally {
      watcher.close();
      await fsp.rm(directory, { recursive: true, force: true });
    }
  });

  test("reports a removed directory so listings refresh", async () => {
    const directory = await fsp.mkdtemp(
      path.join(os.tmpdir(), "srvmd-watcher-"),
    );
    const removed = path.join(directory, "olddir");
    await fsp.mkdir(removed);

    const changes: string[][] = [];
    const watcher = await createWatcher({
      root: directory,
      onChange: files => changes.push(files),
    });

    try {
      await fsp.rm(removed, { recursive: true });
      await waitFor(() => changes.flat().includes(removed));
    } finally {
      watcher.close();
      await fsp.rm(directory, { recursive: true, force: true });
    }
  });
});
