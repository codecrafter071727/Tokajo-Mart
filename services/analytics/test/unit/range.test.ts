import { describe, expect, it } from "vitest";
import { indiaDay, resolveRange } from "../../src/modules/analytics/range";

describe("report range", () => {
  const now = new Date("2026-11-13T20:00:00.000Z"); // 01:30 on 14 Nov in India

  it("uses India days, not UTC days", () => {
    expect(indiaDay(now)).toBe("2026-11-14");
    expect(indiaDay(new Date("2026-11-13T18:29:59.000Z"))).toBe("2026-11-13");
    expect(indiaDay(new Date("2026-11-13T18:30:00.000Z"))).toBe("2026-11-14");
  });

  it("defaults to the last 30 days ending today in India", () => {
    const r = resolveRange({}, now);
    expect(r).toMatchObject({ from: "2026-10-16", to: "2026-11-14", days: 30 });
    expect(r.start.toISOString()).toBe("2026-10-15T18:30:00.000Z");
    expect(r.end.toISOString()).toBe("2026-11-14T18:30:00.000Z");
  });

  it("counts both ends", () => {
    expect(resolveRange({ from: "2024-03-01", to: "2024-03-01" }, now).days).toBe(1);
    expect(resolveRange({ from: "2024-01-01", to: "2024-12-31" }, now).days).toBe(366);
  });

  it("refuses backwards, too long and impossible ranges", () => {
    expect(() => resolveRange({ from: "2024-03-02", to: "2024-03-01" }, now)).toThrow(/after/);
    expect(() => resolveRange({ from: "2023-01-01", to: "2024-01-02" }, now)).toThrow(/366/);
    expect(() => resolveRange({ from: "2024-02-30", to: "2024-03-01" }, now)).toThrow(/real date/);
  });
});
