import { describe, expect, test } from "bun:test";
import { matchesEtag } from "./validators.ts";

const ETAG = 'W/"1a2b3c"';

describe("matchesEtag", () => {
  test("matches the same weak validator", () => {
    expect(matchesEtag(ETAG, ETAG)).toBe(true);
  });

  test("compares weakly so a strong validator still matches", () => {
    expect(matchesEtag('"1a2b3c"', ETAG)).toBe(true);
    expect(matchesEtag('W/"other"', ETAG)).toBe(false);
  });

  test("supports the wildcard and comma-separated lists", () => {
    expect(matchesEtag("*", ETAG)).toBe(true);
    expect(matchesEtag(`W/"a", ${ETAG}`, ETAG)).toBe(true);
    expect(matchesEtag('W/"a", W/"b"', ETAG)).toBe(false);
  });

  test("rejects a missing or empty header", () => {
    expect(matchesEtag(null, ETAG)).toBe(false);
    expect(matchesEtag("", ETAG)).toBe(false);
  });
});
