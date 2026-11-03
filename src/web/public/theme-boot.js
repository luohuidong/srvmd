(() => {
  var stored = null;
  try {
    stored = localStorage.getItem("serve-md-theme");
  } catch {}
  // Missing, invalid, "system" and legacy "auto" all follow the OS.
  var preference = stored === "light" || stored === "dark" ? stored : "system";
  var theme = preference;
  if (theme === "system") {
    theme = window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  document.documentElement.dataset.theme = theme;
})();
