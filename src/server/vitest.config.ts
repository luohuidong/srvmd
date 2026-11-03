import url from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: url.fileURLToPath(new URL(".", import.meta.url)),
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
