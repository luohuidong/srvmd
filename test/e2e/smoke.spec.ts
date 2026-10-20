import { expect, test } from "@playwright/test";

test("renders a document and opens the Mermaid viewer", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Welcome");
  await expect(page.locator(".markdown-body h1")).toContainText("Welcome");
  await expect(page.locator(".toc")).toBeVisible();

  const figure = page.locator(".mermaid-figure");
  await expect(figure).toHaveAttribute("data-mermaid-state", "rendered", { timeout: 20_000 });
  await figure.click();

  const dialog = page.locator("dialog.mermaid-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".mermaid-modal-stage svg")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("renders a directory listing", async ({ page }) => {
  await page.goto("/assets/");

  await expect(page.locator(".listing h1")).toHaveText("Index of /assets/");
  await expect(page.getByRole("link", { name: "notes.txt" })).toBeVisible();
});

test("renders the Svelte 404 page", async ({ page }) => {
  const response = await page.goto("/missing");
  expect(response?.status()).toBe(404);

  await expect(page.locator(".error-code")).toHaveText("404");
  await expect(page.locator(".error-page h1")).toHaveText("Page not found");
});

test("persists the theme toggle", async ({ page }) => {
  await page.goto("/guide/setup");

  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  await page.locator(".theme-toggle").click();

  const after = await html.getAttribute("data-theme");
  expect(after).not.toBe(before);
  expect(after).toBeTruthy();

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", after ?? "");
});

test("serves raw markdown and static assets", async ({ request }) => {
  const raw = await request.get("/guide/setup.md?raw");
  expect(raw.ok()).toBe(true);
  expect(await raw.text()).toContain("# Setup");

  const asset = await request.get("/assets/notes.txt");
  expect(asset.ok()).toBe(true);
  expect(await asset.text()).toContain("plain text file");
});
