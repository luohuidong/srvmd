import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type StartupInfo, startupReportLines } from "./report.js";

const BASE: StartupInfo = {
  root: "/srv/docs",
  url: "http://localhost:3000",
  port: 3000,
};

// styleText reads the color environment on every call, so clear it to keep each case deterministic.
function clearColorEnv(): void {
  delete process.env.FORCE_COLOR;
  delete process.env.NO_COLOR;
  delete process.env.NODE_DISABLE_COLORS;
}

beforeEach(clearColorEnv);
afterEach(clearColorEnv);

describe("startupReportLines", () => {
  test("reports live reload and the watcher", () => {
    const lines = startupReportLines(BASE);

    expect(lines).toContain("  Features  live reload");
    expect(lines).toContain("  Watched   file changes (Ctrl+C to stop)");
  });

  test("never emits empty or trailing-whitespace lines", () => {
    for (const line of startupReportLines(BASE)) {
      expect(line.trim()).not.toBe("");
      expect(line).toBe(line.trimEnd());
    }
  });

  test("stays plain when NO_COLOR is set", () => {
    process.env.NO_COLOR = "1";

    expect(startupReportLines(BASE)[0]).toBe("srvmd");
  });

  test("styles the title and URL when color is forced on", () => {
    process.env.FORCE_COLOR = "1";
    const lines = startupReportLines(BASE);

    expect(lines[0]).toContain("\u001b[");
    expect(lines[2]).toContain("\u001b[");
  });
});
