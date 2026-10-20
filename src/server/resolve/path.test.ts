import { describe, expect, test } from "bun:test";
import { createFixture } from "../../../test/fixture.ts";
import { resolveRequest } from "./path.ts";

describe("resolveRequest", () => {
  test("resolves files inside the root", async () => {
    const root = await createFixture();
    const result = await resolveRequest(root, "/a.md");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.resolved.relative).toBe("a.md");
  });

  test("rejects traversal outside the root", async () => {
    const root = await createFixture();
    const result = await resolveRequest(root, "/../../etc/passwd");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  test("rejects encoded traversal", async () => {
    const root = await createFixture();
    const result = await resolveRequest(root, "/%2e%2e%2f%2e%2e%2fetc%2fpasswd");
    expect(result.ok).toBe(false);
  });

  test("rejects malformed percent encoding", async () => {
    const root = await createFixture();
    const result = await resolveRequest(root, "/%E0%A4%A");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  test("rejects hidden paths", async () => {
    const root = await createFixture();
    const result = await resolveRequest(root, "/.hidden.md");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  test("returns 404 for missing files", async () => {
    const root = await createFixture();
    const result = await resolveRequest(root, "/nope.md");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});
