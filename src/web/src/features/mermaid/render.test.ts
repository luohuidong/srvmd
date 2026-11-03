import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadMermaid: vi.fn(),
  initialize: vi.fn(),
  render: vi.fn(),
}));

vi.mock("./load.ts", () => ({
  loadMermaid: mocks.loadMermaid,
}));

import { renderDiagram } from "./render.ts";

beforeEach(() => {
  mocks.loadMermaid.mockReset();
  mocks.initialize.mockReset();
  mocks.render.mockReset();
  mocks.loadMermaid.mockResolvedValue({
    initialize: mocks.initialize,
    render: mocks.render,
  });
  mocks.render.mockImplementation(async (id: string, source: string) => ({
    svg: `<svg data-id="${id}">${source}</svg>`,
  }));
});

describe("renderDiagram", () => {
  test("skips a queued render when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      renderDiagram("graph TD; A-->B", "light", controller.signal),
    ).rejects.toMatchObject({
      name: "AbortError",
    });

    expect(mocks.loadMermaid).not.toHaveBeenCalled();
    expect(mocks.render).not.toHaveBeenCalled();
  });
});
