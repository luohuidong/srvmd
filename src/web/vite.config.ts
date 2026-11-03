import url from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { constants } from "../shared/src/index.ts";

const shared = url.fileURLToPath(
  new URL("../shared/src/index.ts", import.meta.url),
);
const lib = url.fileURLToPath(new URL("./src/lib", import.meta.url));
const devUrl = new URL(
  process.env.SRVMD_DEV_WEB_URL ?? "http://localhost:5180",
);
const DEV_PORT = devUrl.port ? Number(devUrl.port) : 5180;

export default defineConfig({
  root: url.fileURLToPath(new URL(".", import.meta.url)),
  base: `${constants.APP_ASSET_PREFIX}/`,
  publicDir: "public",
  plugins: [svelte()],
  server: {
    port: DEV_PORT,
    strictPort: true,
    // The page is served by srvmd, so HMR must connect to Vite directly.
    ws: { clientPort: DEV_PORT },
  },
  resolve: {
    alias: [
      { find: /^@shared$/, replacement: shared },
      { find: "$lib", replacement: lib },
    ],
  },
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: url.fileURLToPath(new URL("./index.html", import.meta.url)),
        "live-static": url.fileURLToPath(
          new URL("./src/live-static.ts", import.meta.url),
        ),
      },
      output: {
        entryFileNames: chunk =>
          chunk.name === "live-static"
            ? "live-static.js"
            : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
