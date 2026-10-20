import { networkInterfaces } from "node:os";

export type StartupReport = {
  root: string;
  url: string;
  port: number;
  features: string[];
};

function color(enabled: boolean, code: string, text: string): string {
  return enabled ? `\u001b[${code}m${text}\u001b[0m` : text;
}

function localNetworkUrls(port: number): string[] {
  const urls: string[] = [];
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      const family = String(address.family);
      if ((family === "IPv4" || family === "4") && !address.internal) {
        urls.push(`http://${address.address}:${port}`);
      }
    }
  }
  return urls;
}

export function printStartupReport(report: StartupReport): void {
  const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
  const lines = [
    color(useColor, "1", "serve-markdown"),
    `  Serving   ${report.root}`,
    `  Local     ${color(useColor, "36", report.url)}`,
  ];

  for (const networkUrl of localNetworkUrls(report.port)) lines.push(`  Network   ${networkUrl}`);
  lines.push(`  Features  ${report.features.join(", ")}`);
  lines.push("  Watched   markdown, html and css files (Ctrl+C to stop)");

  process.stdout.write(`${lines.join("\n")}\n`);
}
