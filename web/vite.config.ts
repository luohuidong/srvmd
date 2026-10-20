import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

const shared = fileURLToPath(new URL("../src/shared", import.meta.url));
const lib = fileURLToPath(new URL("./src/lib", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/__app/",
  publicDir: "public",
  plugins: [svelte()],
  resolve: {
    alias: {
      "@shared": shared,
      $lib: lib,
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        "live-static": fileURLToPath(new URL("./src/live-static.ts", import.meta.url)),
      },
      output: {
        entryFileNames: chunk => (chunk.name === "live-static" ? "live-static.js" : "assets/[name]-[hash].js"),
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
