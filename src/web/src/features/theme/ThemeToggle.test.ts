import { fireEvent, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { THEME_STORAGE_KEY } from "../../lib/constants.ts";
import ThemeToggle from "./ThemeToggle.svelte";
import { setTheme, theme } from "./theme.svelte.ts";

function mockSystemTheme(matches: boolean) {
  const listeners: ((event: MediaQueryListEvent) => void)[] = [];
  const media = {
    matches,
    addEventListener: vi.fn(
      (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.push(listener);
      },
    ),
    removeEventListener: vi.fn(),
  };

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media as unknown as MediaQueryList),
  );

  return {
    media,
    setMatches(value: boolean) {
      media.matches = value;
      for (const listener of listeners)
        listener({ matches: value } as MediaQueryListEvent);
    },
  };
}

beforeEach(() => {
  setTheme("light");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemeToggle", () => {
  test("cycles light, dark and system, then persists the preference", async () => {
    const system = mockSystemTheme(true);
    const { container } = render(ThemeToggle);
    const button = container.querySelector("button") as HTMLButtonElement;

    expect(theme.preference).toBe("light");
    expect(theme.value).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(button.getAttribute("aria-label")).toBe(
      "Theme: Light. Switch to Dark.",
    );

    await fireEvent.click(button);
    expect(theme.preference).toBe("dark");
    expect(theme.value).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(button.getAttribute("aria-label")).toBe(
      "Theme: Dark. Switch to System.",
    );

    await fireEvent.click(button);
    expect(theme.preference).toBe("system");
    expect(theme.value).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(button.getAttribute("aria-label")).toBe(
      "Theme: System. Switch to Light.",
    );
    expect(system.media.addEventListener).toHaveBeenCalledTimes(1);

    system.setMatches(false);
    expect(theme.value).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    await fireEvent.click(button);
    expect(theme.preference).toBe("light");
    expect(theme.value).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    system.setMatches(true);
    expect(theme.value).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
