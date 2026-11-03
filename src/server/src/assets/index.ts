import path from "node:path";
import { constants } from "../../../shared/src/index.js";
import { assertNever } from "../assert.js";
import type { ResolvedWebSource } from "../config.js";
import { createDevWebAssets } from "./dev.js";
import { createShellCache } from "./shell.js";
import type { WebAssets } from "./types.js";
import { respondWebAsset } from "./web.js";

export type { WebAssets } from "./types.js";

/** Create the asset reader for the resolved web source. */
export function createWebAssets(web: ResolvedWebSource): WebAssets {
  switch (web.kind) {
    case "dist": {
      const shell = createShellCache(web.root);
      return {
        readShell: () => shell.read(),
        respondAsset: (url, request) => respondWebAsset(web.root, url, request),
        liveStaticPath: `${constants.APP_ASSET_PREFIX}/live-static.js`,
        unavailableMessage: `srvmd: web assets are missing at ${path.join(web.root, "index.html")}.`,
      };
    }
    case "dev":
      return createDevWebAssets(web.url);
    default:
      return assertNever(web);
  }
}
