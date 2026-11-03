import fs from "node:fs";
import path from "node:path";

const webRoot = path.join(import.meta.dirname, "../../../dist/web");

const REQUIRED_FILES = ["index.html", "live-static.js", "theme-boot.js"];

function missingArtifacts(): string[] {
  const missing = REQUIRED_FILES.filter(
    file => !fs.existsSync(path.join(webRoot, file)),
  );

  const assetsDirectory = path.join(webRoot, "assets");
  const hasAssets =
    fs.existsSync(assetsDirectory) &&
    fs.readdirSync(assetsDirectory).some(name => name.endsWith(".js"));
  if (!hasAssets) missing.push("assets/*.js");

  return missing;
}

/** Fail the package build when the web bundle is missing or incomplete. */
const missing = missingArtifacts();
if (missing.length > 0) {
  throw new Error(
    `dist is incomplete (missing ${missing.join(", ")}). Run \`pnpm run build:web\` first.`,
  );
}
