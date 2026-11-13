import { describe, expect, it } from "vitest";
import { formatOpening, indiaClock, serviceState } from "../src/lib/serviceMessages";

const now = new Date("2026-11-13T21:30:00Z"); // 3:00 AM on 14 Nov in India

describe("opening times in India time", () => {
  it("prints a 12 hour clock", () => {
    expect(indiaClock(new Date("2026-11-14T00:30:00Z"))).toBe("6:00 AM");
    expect(indiaClock(new Date("2026-11-14T13:30:00Z"))).toBe("7:00 PM");
    expect(indiaClock(new Date("2026-11-13T18:30:00Z"))).toBe("12:00 AM");
  });

  it("says today, tomorrow or the day", () => {
    expect(formatOpening("2026-11-14T00:30:00Z", now)).toBe("6:00 AM");
    expect(formatOpening("2026-11-15T00:30:00Z", now)).toBe("6:00 AM tomorrow");
    expect(formatOpening("2026-11-16T00:30:00Z", now)).toMatch(/^6:00 AM on Mon,? 16 Nov$/);
  });
});

describe("what to tell the customer", () => {
  const base = { warehouseId: null, etaMins: null };
  it("shows the delivery time when open", () => {
    expect(
      serviceState({ serviceable: true, warehouseId: "w", etaMins: 9, reason: null }, null),
    ).toEqual({
      kind: "open",
      etaMins: 9,
    });
  });

  it("says when a closed store opens", () => {
    const s = serviceState(
      { ...base, serviceable: false, reason: "WAREHOUSE_CLOSED", opensAt: "2026-11-14T00:30:00Z" },
      "201309",
      now,
    );
    expect(s).toMatchObject({ kind: "closed", detail: "Closed now, opens at 6:00 AM" });
    const noTime = serviceState(
      { ...base, serviceable: false, reason: "WAREHOUSE_CLOSED" },
      null,
      now,
    );
    expect(noTime).toMatchObject({ kind: "closed", detail: "Closed now. We will be back soon." });
  });

  it("names the pincode when the pincode decided", () => {
    const s = serviceState(
      { ...base, serviceable: false, reason: "OUTSIDE_SERVICE_AREA", matchedBy: "pincode" },
      "110011",
    );
    expect(s).toMatchObject({ kind: "not_served", detail: "We do not deliver to 110011 yet" });
    const radius = serviceState(
      { ...base, serviceable: false, reason: "OUTSIDE_SERVICE_AREA", matchedBy: "radius" },
      "110011",
    );
    expect(radius).toMatchObject({ detail: "We do not deliver to this area yet" });
  });
});
