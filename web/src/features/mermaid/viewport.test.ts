import { describe, expect, test } from "vitest";
import { clampScale, fitState, panBy, zoomAt, zoomBy } from "./viewport.ts";

describe("clampScale", () => {
  test("keeps the scale inside the supported range", () => {
    expect(clampScale(0.01)).toBe(0.1);
    expect(clampScale(100)).toBe(8);
    expect(clampScale(1.5)).toBe(1.5);
  });
});

describe("fitState", () => {
  test("centers the diagram and never exceeds 1.5x", () => {
    const state = fitState(800, 600, 1000, 800);
    expect(state.scale).toBeCloseTo(1.16);
    expect(state.x).toBeCloseTo(36);
    expect(state.y).toBeCloseTo(52);
  });

  test("uses the minimum scale needed for oversized diagrams", () => {
    const state = fitState(4000, 2000, 1000, 800);
    expect(state.scale).toBeLessThan(1);
    expect(state.x).toBeCloseTo((1000 - 4000 * state.scale) / 2);
    expect(state.y).toBeCloseTo((800 - 2000 * state.scale) / 2);
  });
});

describe("zoomAt", () => {
  test("keeps the point under the cursor stationary", () => {
    const state = { width: 100, height: 100, scale: 1, x: 0, y: 0 };
    const next = zoomAt(state, 50, 50, 2);

    expect(next.scale).toBe(2);
    expect(next.x).toBe(-50);
    expect(next.y).toBe(-50);
    expect(50 * next.scale + next.x).toBe(50);
    expect(50 * next.scale + next.y).toBe(50);
  });

  test("clamps the requested scale", () => {
    const state = { width: 100, height: 100, scale: 1, x: 0, y: 0 };
    expect(zoomAt(state, 0, 0, 100).scale).toBe(8);
    expect(zoomAt(state, 0, 0, 0.001).scale).toBe(0.1);
  });
});

describe("zoomBy", () => {
  test("zooms around the viewport center", () => {
    const state = { width: 100, height: 100, scale: 1, x: 0, y: 0 };
    const next = zoomBy(state, 200, 100, 2);

    expect(next.scale).toBe(2);
    expect(next.x).toBe(-100);
    expect(next.y).toBe(-50);
  });
});

describe("panBy", () => {
  test("moves the stage without changing scale", () => {
    const state = { width: 100, height: 100, scale: 1.5, x: 10, y: 20 };
    const next = panBy(state, -5, 7);

    expect(next.x).toBe(5);
    expect(next.y).toBe(27);
    expect(next.scale).toBe(1.5);
  });
});
