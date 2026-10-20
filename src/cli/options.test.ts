import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { type RawCliOptions, toServerOptions } from "./options.ts";

const raw: RawCliOptions = {
  listen: "127.0.0.1:8080",
  open: false,
  single: true,
  cors: true,
  theme: "dark",
  html: "allow",
  math: true,
  ignore: ["node_modules"],
  live: false,
  highlight: false,
  mermaid: false,
  cleanUrls: false,
  directoryListing: false,
};

describe("toServerOptions", () => {
  test("maps Commander values onto server options", () => {
    const options = toServerOptions("example/docs", raw);

    expect(options.root).toBe(resolve("example/docs"));
    expect(options).toMatchObject({
      hostname: "127.0.0.1",
      port: 8080,
      single: true,
      cors: true,
      theme: "dark",
      html: "allow",
      math: true,
      ignore: ["node_modules"],
      live: false,
      highlight: false,
      mermaid: false,
      cleanUrls: false,
      directoryListing: false,
    });
  });

  test("rejects invalid theme and html values", () => {
    expect(() => toServerOptions(".", { ...raw, theme: "blue" })).toThrow("Invalid --theme");
    expect(() => toServerOptions(".", { ...raw, html: "unsafe" })).toThrow("Invalid --html");
  });
});
