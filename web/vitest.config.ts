import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

const shared = fileURLToPath(new URL("../src/shared", import.meta.url));
const lib = fileURLToPath(new URL("./src/lib", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [svelte()],
  resolve: {
    alias: {
      "@shared": shared,
      $lib: lib,
    },
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
