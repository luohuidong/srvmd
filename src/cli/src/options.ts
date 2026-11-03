import type { ServerOptions } from "../../server/src/index.js";

export type RawCliOptions = {
  port?: string;
  open?: boolean;
  ignore?: string[];
};

/** Accept a bare port number only; `0` asks the OS for a random free port. */
function parsePort(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const port = /^\d+$/.test(value) ? Number(value) : -1;
  if (port < 0 || port > 65535) {
    throw new Error(
      `Invalid --port value: ${value} (expected a number from 0 to 65535)`,
    );
  }

  return port;
}

/**
 * Map Commander's raw values onto the server options, applying the CLI defaults
 * here so the server only validates and normalizes fully specified values.
 */
export function toServerOptions(
  directory: string,
  raw: RawCliOptions,
): Omit<ServerOptions, "web"> {
  return {
    root: directory,
    // No default port: the OS picks a free one and the startup report prints it.
    port: parsePort(raw.port) ?? 0,
    ignore: raw.ignore ?? [],
  };
}
