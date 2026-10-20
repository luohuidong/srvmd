import { describe, expect, test } from "bun:test";
import { parseListen } from "./listen.ts";

describe("parseListen", () => {
  test("defaults to port 3000", () => {
    expect(parseListen(undefined)).toEqual({ port: 3000 });
  });

  test("parses a bare port", () => {
    expect(parseListen("8080")).toEqual({ port: 8080 });
  });

  test("parses host:port", () => {
    expect(parseListen("127.0.0.1:8080")).toEqual({ hostname: "127.0.0.1", port: 8080 });
  });

  test("parses bracketed IPv6", () => {
    expect(parseListen("[::1]:8080")).toEqual({ hostname: "::1", port: 8080 });
  });

  test("rejects malformed values", () => {
    expect(() => parseListen("nope")).toThrow("Invalid --listen value");
    expect(() => parseListen("127.0.0.1:99999")).toThrow("Invalid port");
  });
});
