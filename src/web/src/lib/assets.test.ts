import { constants } from "@shared";
import { describe, expect, test } from "vitest";
import indexHtml from "../../index.html?raw";
import themeBoot from "../../public/theme-boot.js?raw";
import { THEME_STORAGE_KEY } from "./constants.ts";

describe("static asset contracts", () => {
  test("index.html carries the shell marker used by the dev proxy", () => {
    expect(indexHtml).toContain(constants.SHELL_MARKER);
  });

  test("theme-boot.js reads the same storage key as the app", () => {
    expect(themeBoot).toContain(THEME_STORAGE_KEY);
  });
});
