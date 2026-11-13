import { describe, expect, it } from "vitest";
import { freshness, layoutPoints } from "../src/lib/trackingMath";

describe("tracking card helpers", () => {
  it("says how fresh the rider's position is", () => {
    expect(freshness(3)).toBe("just now");
    expect(freshness(42)).toBe("42 s ago");
    expect(freshness(185)).toBe("3 min ago");
  });

  it("lays out store, rider and home north up inside the padding", () => {
    const [store, rider, home] = layoutPoints([
      { lat: 28.61, lng: 77.35 },
      { lat: 28.615, lng: 77.355 },
      { lat: 28.62, lng: 77.36 },
    ]);
    for (const p of [store, rider, home]) {
      expect(p!.x).toBeGreaterThanOrEqual(0.12 - 1e-9);
      expect(p!.x).toBeLessThanOrEqual(0.88 + 1e-9);
    }
    // Home is further north, so higher on screen (smaller y)
    expect(home!.y).toBeLessThan(store!.y);
    expect(rider!.x).toBeCloseTo(0.5, 5);
  });

  it("copes with one point or none", () => {
    expect(layoutPoints([])).toEqual([]);
    expect(layoutPoints([{ lat: 1, lng: 2 }])[0]).toEqual({ x: 0.5, y: 0.5 });
  });
});
