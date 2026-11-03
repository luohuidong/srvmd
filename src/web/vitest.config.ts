import url from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

const shared = url.fileURLToPath(
  new URL("../shared/src/index.ts", import.meta.url),
);
const lib = url.fileURLToPath(new URL("./src/lib", import.meta.url));

export default defineConfig({
  root: url.fileURLToPath(new URL(".", import.meta.url)),
  plugins: [svelte()],
  resolve: {
    alias: [
      { find: /^@shared$/, replacement: shared },
      { find: "$lib", replacement: lib },
    ],
    conditions: ["browser"],
    dedupe: ["svelte"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
  },
});
