import { connectLive } from "./features/live/live.ts";

const SCROLL_KEY = "serve-md-scroll";

connectLive(() => {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  } catch {
    // Storage can be unavailable.
  }
  window.location.reload();
});

window.addEventListener("load", () => {
  try {
    const value = sessionStorage.getItem(SCROLL_KEY);
    if (value === null) return;
    sessionStorage.removeItem(SCROLL_KEY);
    window.scrollTo({ top: Number(value) });
  } catch {
    // Ignore storage/scroll failures.
  }
});
