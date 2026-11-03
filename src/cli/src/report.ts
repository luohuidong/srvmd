import os from "node:os";
import util from "node:util";

export type StartupInfo = {
  /** Absolute path of the served directory, with symlinks resolved. */
  root: string;
  url: string;
  port: number;
};

function localNetworkUrls(port: number): string[] {
  const urls: string[] = [];
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      const family = String(address.family);
      if ((family === "IPv4" || family === "4") && !address.internal) {
        urls.push(`http://${address.address}:${port}`);
      }
    }
  }
  return urls;
}

/** Build the startup report. Exported so the formatting is testable without capturing stdout. */
export function startupReportLines(info: StartupInfo): string[] {
  const lines = [
    util.styleText("bold", "srvmd"),
    `  Serving   ${info.root}`,
    `  Local     ${util.styleText("cyan", info.url)}`,
  ];

  for (const networkUrl of localNetworkUrls(info.port))
    lines.push(`  Network   ${networkUrl}`);

  lines.push("  Features  live reload");
  lines.push("  Watched   file changes (Ctrl+C to stop)");

  return lines;
}

export function printStartupReport(info: StartupInfo): void {
  process.stdout.write(`${startupReportLines(info).join("\n")}\n`);
}
