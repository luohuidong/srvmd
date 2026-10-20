export type ListenOptions = {
  hostname?: string;
  port: number;
};

function assertPort(port: number, source: string): number {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port in --listen value: ${source}`);
  }
  return port;
}

/** Parse `3000`, `host:3000`, or `[::1]:3000`. */
export function parseListen(value: string | undefined): ListenOptions {
  if (!value) return { port: 3000 };
  if (/^\d+$/.test(value)) return { port: assertPort(Number(value), value) };

  const bracketed = /^\[([^\]]+)\]:(\d+)$/.exec(value);
  if (bracketed) return { hostname: bracketed[1], port: assertPort(Number(bracketed[2]), value) };

  const separator = value.lastIndexOf(":");
  if (separator === -1) throw new Error(`Invalid --listen value: ${value}`);

  const hostname = value.slice(0, separator) || undefined;
  const port = assertPort(Number(value.slice(separator + 1)), value);
  return { hostname, port };
}
