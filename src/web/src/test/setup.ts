import { cleanup } from "@testing-library/svelte";
import { afterEach, beforeEach } from "vitest";

beforeEach(() => {
  document.documentElement.dataset.theme = "light";
});

afterEach(() => {
  cleanup();
});

if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };

  HTMLDialogElement.prototype.close = function close() {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
