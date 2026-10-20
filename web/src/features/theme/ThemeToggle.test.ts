import { THEME_STORAGE_KEY } from "@shared/constants.ts";
import { fireEvent, render } from "@testing-library/svelte";
import { beforeEach, describe, expect, test } from "vitest";
import ThemeToggle from "./ThemeToggle.svelte";
import { setTheme, theme } from "./theme.svelte.ts";

beforeEach(() => {
  setTheme("light");
});

describe("ThemeToggle", () => {
  test("toggles the document theme and persists it", async () => {
    const { container } = render(ThemeToggle);
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(theme.value).toBe("light");

    await fireEvent.click(button as HTMLButtonElement);
    expect(theme.value).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    await fireEvent.click(button as HTMLButtonElement);
    expect(theme.value).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
