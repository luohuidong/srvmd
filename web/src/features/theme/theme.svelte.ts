import { THEME_STORAGE_KEY } from "@shared/constants.ts";
import type { ResolvedTheme } from "@shared/types.ts";

function currentTheme(): ResolvedTheme {
  if (typeof document !== "undefined" && document.documentElement.dataset.theme === "dark") return "dark";
  if (typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

export const theme = $state<{ value: ResolvedTheme }>({ value: currentTheme() });

export function setTheme(value: ResolvedTheme): void {
  theme.value = value;

  if (typeof document !== "undefined") document.documentElement.dataset.theme = value;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // Storage can be unavailable in private/embedded contexts.
  }
}

export function toggleTheme(): void {
  setTheme(theme.value === "dark" ? "light" : "dark");
}
