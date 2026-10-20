import { Command } from "commander";
import pkg from "../../package.json";
import { startServer } from "../server/create-server.ts";
import { openInBrowser } from "./browser.ts";
import { installSignalHandlers } from "./lifecycle.ts";
import { type RawCliOptions, toServerOptions } from "./options.ts";
import { printStartupReport } from "./report.ts";

function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function createCommand(): Command {
  return new Command()
    .name("serve-markdown")
    .description("A static file server that renders Markdown, with live reload.")
    .usage("[directory] [options]")
    .argument("[directory]", "directory to serve", ".")
    .option("-l, --listen <value>", "port or interface to listen on", "3000")
    .option("-o, --open", "open the served URL in the default browser")
    .option("-s, --single", "serve index.html (or index.md) for unmatched routes")
    .option("-c, --cors", "send permissive CORS headers")
    .option("--theme <theme>", "default theme: auto, light or dark", "auto")
    .option("--html <mode>", "raw HTML handling: filter, allow or off", "filter")
    .option("--math", "enable $inline$ and $$display$$ math")
    .option("--ignore <name>", "extra names the watcher should ignore (repeatable)", collect, [])
    .option("--no-live", "disable live reload over WebSocket")
    .option("--no-highlight", "disable syntax highlighting")
    .option("--no-mermaid", "disable Mermaid diagram rendering")
    .option("--no-clean-urls", "disable resolving /page to page.md")
    .option("--no-directory-listing", "disable generated directory indexes")
    .version(pkg.version, "-v, --version", "print the version")
    .helpOption("-h, --help", "display help for command")
    .showHelpAfterError()
    .action(async (directory: string, raw: RawCliOptions) => {
      const options = toServerOptions(directory, raw);
      const running = await startServer(options);

      printStartupReport({
        root: running.root,
        url: running.url,
        port: running.port,
        features: [
          options.live !== false ? "live reload" : null,
          options.highlight !== false ? "highlight" : null,
          options.mermaid !== false ? "mermaid" : null,
          options.cleanUrls !== false ? "clean urls" : null,
          options.directoryListing !== false ? "directory listing" : null,
          options.single ? "single page" : null,
        ].filter((feature): feature is string => feature !== null),
      });

      if (raw.open) await openInBrowser(running.url);
      installSignalHandlers(() => running.close());
    });
}
