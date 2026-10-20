(() => {
  var node = document.getElementById("serve-md-config");
  var config = {};
  try {
    config = node ? JSON.parse(node.textContent || "{}") : {};
  } catch {}
  var stored = null;
  try {
    stored = localStorage.getItem("serve-md-theme");
  } catch {}
  var theme = stored || config.theme || "auto";
  if (theme === "auto") {
    theme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.theme = theme;
})();
