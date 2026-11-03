import { THEME_STORAGE_KEY } from "../../lib/constants.ts";
import type { ResolvedTheme, ThemePreference } from "../../lib/types.ts";

const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

function storedPreference(): ThemePreference {
  if (typeof localStorage === "undefined") return "system";

  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
    // "auto" was used by older builds; keep it working as "system".
    return "system";
  } catch {
    // Storage can be unavailable in private/embedded contexts.
    return "system";
  }
}

function systemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    return window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light";
  }
  return "light";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

function applyTheme(value: ResolvedTheme): void {
  if (typeof document !== "undefined")
    document.documentElement.dataset.theme = value;
}

function persistPreference(preference: ThemePreference): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable in private/embedded contexts.
  }
}

const initialPreference = storedPreference();

export const theme = $state<{
  preference: ThemePreference;
  value: ResolvedTheme;
}>({
  preference: initialPreference,
  value: resolveTheme(initialPreference),
});

applyTheme(theme.value);

let media: MediaQueryList | null = null;

function handleSystemThemeChange(event: MediaQueryListEvent): void {
  if (theme.preference !== "system") return;
  theme.value = event.matches ? "dark" : "light";
  applyTheme(theme.value);
}

function watchSystemTheme(): void {
  if (
    media ||
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  )
    return;

  media = window.matchMedia(SYSTEM_THEME_QUERY);
  media.addEventListener("change", handleSystemThemeChange);
}

export function setTheme(preference: ThemePreference): void {
  theme.preference = preference;
  theme.value = resolveTheme(preference);
  persistPreference(preference);
  applyTheme(theme.value);

  if (preference === "system") watchSystemTheme();
}

export function cycleTheme(): void {
  const next: Record<ThemePreference, ThemePreference> = {
    light: "dark",
    dark: "system",
    system: "light",
  };
  setTheme(next[theme.preference]);
}

if (initialPreference === "system") watchSystemTheme();
