import { describe, expect, test } from "vitest";
import { type RawCliOptions, toServerOptions } from "./options.js";

const raw: RawCliOptions = {
  port: "8080",
  open: false,
  ignore: ["node_modules"],
};

describe("toServerOptions", () => {
  test("maps Commander values onto server options", () => {
    const options = toServerOptions("example/docs", raw);

    expect(options.root).toBe("example/docs");
    expect(options).toMatchObject({
      port: 8080,
      ignore: ["node_modules"],
    });
  });

  test("applies the CLI defaults when options are omitted", () => {
    const options = toServerOptions("example/docs", {});

    expect(options).toEqual({
      root: "example/docs",
      port: 0,
      ignore: [],
    });
  });

  test("passes an explicit port through, including 0", () => {
    expect(toServerOptions("example/docs", { port: "0" }).port).toBe(0);
    expect(toServerOptions("example/docs", { port: "65535" }).port).toBe(65535);
  });

  test("rejects non-numeric and out-of-range ports", () => {
    const invalid = [
      "",
      "nope",
      "127.0.0.1:8080",
      "[::1]:8080",
      "-1",
      "65536",
      "8 080",
    ];

    for (const port of invalid) {
      expect(() => toServerOptions("example/docs", { port })).toThrow(
        "Invalid --port value",
      );
    }
  });
});
