import { describe, expect, it } from "vitest";
import { payoutFor, startOfIndiaDay } from "../../src/modules/delivery/service";

describe("rider pay", () => {
  it("is a base plus a per kilometre amount, in whole paise", () => {
    expect(payoutFor(0)).toBe(3000);
    expect(payoutFor(1.5)).toBe(4200);
    expect(Number.isInteger(payoutFor(2.37))).toBe(true);
  });
});

describe("today", () => {
  it("starts at midnight in India", () => {
    // 20:00 UTC on 12 Nov is 01:30 on 13 Nov in India
    expect(startOfIndiaDay(new Date("2026-11-12T20:00:00Z")).toISOString()).toBe(
      "2026-11-12T18:30:00.000Z",
    );
    expect(startOfIndiaDay(new Date("2026-11-13T10:00:00Z")).toISOString()).toBe(
      "2026-11-12T18:30:00.000Z",
    );
  });
});
