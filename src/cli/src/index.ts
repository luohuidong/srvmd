#!/usr/bin/env node
import { createCommand } from "./command.js";

async function main(): Promise<void> {
  const program = createCommand();
  await program.parseAsync(process.argv.slice(2), { from: "user" });
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`srvmd: ${message}\n`);
  process.exit(1);
});
