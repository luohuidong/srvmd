import { Command } from "commander";
import pkg from "../../../package.json" with { type: "json" };
import { startServer } from "../../server/src/index.js";
import { openInBrowser } from "./browser.js";
import { installLifecycleHandlers } from "./lifecycle.js";
import { type RawCliOptions, toServerOptions } from "./options.js";
import { printStartupReport } from "./report.js";
import { resolveWebSource } from "./web-source.js";

export function createCommand(): Command {
  return new Command()
    .name("srvmd")
    .description(
      "A static file server that renders Markdown, with live reload.",
    )
    .usage("[directory] [options]")
    .argument("[directory]", "directory to serve", ".")
    .option(
      "-p, --port <port>",
      "port to listen on (default: a random free port)",
    )
    .option("-o, --open", "open the served URL in the default browser")
    .option(
      "--ignore <name>",
      "extra names the watcher should ignore (repeatable)",
      // The default matters: Commander passes `undefined` on the first hit.
      (value: string, previous: string[] = []) => [...previous, value],
    )
    .version(pkg.version, "-v, --version", "print the version")
    .helpOption("-h, --help", "display help for command")
    .showHelpAfterError()
    .action(async (directory: string, options: RawCliOptions) => {
      const serverOptions = toServerOptions(directory, options);
      const running = await startServer({
        ...serverOptions,
        web: resolveWebSource(process.env.SRVMD_DEV_WEB_URL),
      });
      // Installed right after the listener exists: `--open` can block in the
      // browser launcher, and a signal arriving there would skip cleanup.
      installLifecycleHandlers(() => running.close());

      printStartupReport({
        root: running.root,
        url: running.url,
        port: running.port,
      });

      if (options.open) await openInBrowser(running.url);
    });
}
