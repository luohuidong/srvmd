import { render } from "@testing-library/svelte";
import { describe, expect, test } from "vitest";
import ErrorView from "./ErrorView.svelte";

describe("ErrorView", () => {
  test("renders a 404 page", () => {
    const { container } = render(ErrorView, { props: { status: 404, message: "Not found" } });

    expect(container.querySelector(".error-code")?.textContent).toBe("404");
    expect(container.querySelector("h1")?.textContent).toBe("Page not found");
    expect(container.textContent).toContain("Not found");
    expect(container.querySelector('a[href="/"]')).not.toBeNull();
  });

  test("renders a generic error page", () => {
    const { container } = render(ErrorView, { props: { status: 500, message: "Boom" } });

    expect(container.querySelector(".error-code")?.textContent).toBe("500");
    expect(container.querySelector("h1")?.textContent).toBe("Something went wrong");
    expect(container.textContent).toContain("Boom");
  });
});
