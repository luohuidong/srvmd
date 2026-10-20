#!/usr/bin/env bun
import { createCommand } from "./command.ts";

async function main(): Promise<void> {
  const program = createCommand();
  await program.parseAsync(Bun.argv.slice(2), { from: "user" });
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`serve-markdown: ${message}\n`);
  if (/EADDRINUSE|address already in use/i.test(message)) {
    process.stderr.write("Hint: choose another port with --listen.\n");
  }
  process.exit(1);
});
