import type { OpeningWindow } from "@qc/contracts";
import { describe, expect, it } from "vitest";
import {
  coveringCandidates,
  emptySetup,
  indiaDay,
  normalisePincodes,
  openStatus,
  soonestOpening,
} from "../../src/modules/inventory/schedule";
import { seedWarehouses } from "../../src/modules/inventory/seed";

/** A moment given as India wall clock time, for readable tests. */
const ist = (local: string) => new Date(`${local}+05:30`);
const everyDay = (opensAt: string, closesAt: string): OpeningWindow[] =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensAt, closesAt }));
const open = (
  hours: OpeningWindow[],
  now: Date,
  closures: Parameters<typeof openStatus>[0]["closures"] = [],
) => openStatus({ manualOpen: true, hours, closures }, now);

describe("india days", () => {
  it("uses the India calendar, not UTC", () => {
    // 20:00 UTC on 12 Nov is 01:30 on Friday 13 Nov in India
    expect(indiaDay(new Date("2026-11-12T20:00:00Z"))).toEqual({ day: "2026-11-13", weekday: 5 });
    expect(indiaDay(new Date("2026-11-12T18:29:00Z")).day).toBe("2026-11-12");
  });
});

describe("opening hours", () => {
  it("is open all day when no hours are set", () => {
    expect(open([], ist("2026-11-13T03:00"))).toEqual({
      openNow: true,
      opensAt: null,
      closesAt: null,
      closedBy: null,
    });
  });

  it("is closed by hand with no opening time, whatever the hours say", () => {
    expect(
      openStatus({ manualOpen: false, hours: [], closures: [] }, ist("2026-11-13T12:00")),
    ).toEqual({
      openNow: false,
      opensAt: null,
      closesAt: null,
      closedBy: "manual",
    });
  });

  it("handles a day window and says when it closes", () => {
    const hours = everyDay("09:00", "21:00");
    const s = open(hours, ist("2026-11-13T12:00"));
    expect(s.openNow).toBe(true);
    expect(s.closesAt).toBe(ist("2026-11-13T21:00").toISOString());
    const before = open(hours, ist("2026-11-13T08:59"));
    expect(before).toMatchObject({ openNow: false, closedBy: "hours" });
    expect(before.opensAt).toBe(ist("2026-11-13T09:00").toISOString());
    const after = open(hours, ist("2026-11-13T21:00"));
    expect(after.openNow).toBe(false);
    expect(after.opensAt).toBe(ist("2026-11-14T09:00").toISOString());
  });

  it("stays open past midnight for an overnight window, then closes until morning", () => {
    const hours = everyDay("06:00", "01:00");
    expect(open(hours, ist("2026-11-13T23:30")).openNow).toBe(true);
    // 00:30 is still the previous day's window
    const late = open(hours, ist("2026-11-14T00:30"));
    expect(late.openNow).toBe(true);
    expect(late.closesAt).toBe(ist("2026-11-14T01:00").toISOString());
    const night = open(hours, ist("2026-11-14T03:00"));
    expect(night).toMatchObject({ openNow: false, closedBy: "hours" });
    expect(night.opensAt).toBe(ist("2026-11-14T06:00").toISOString());
    // Exactly at opening it is open
    expect(open(hours, ist("2026-11-14T06:00")).openNow).toBe(true);
  });

  it("treats a missing weekday as closed that day and finds the next open day", () => {
    // Open Monday to Saturday only (no Sunday)
    const hours = [1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      opensAt: "08:00",
      closesAt: "20:00",
    }));
    const sunday = open(hours, ist("2026-11-15T10:00")); // 15 Nov 2026 is a Sunday
    expect(sunday.openNow).toBe(false);
    expect(sunday.opensAt).toBe(ist("2026-11-16T08:00").toISOString());
  });

  it("joins back to back windows into one, so a 24 hour day never closes at midnight", () => {
    const hours = everyDay("00:00", "23:59").map((h) => ({ ...h, closesAt: "00:00" }));
    const s = open(hours, ist("2026-11-13T23:59"));
    expect(s.openNow).toBe(true);
    expect(s.closesAt).toBeNull();
  });

  it("is closed for a holiday and opens the morning after", () => {
    const hours = everyDay("06:00", "01:00");
    const closures = [{ id: "c1", startsOn: "2026-11-14", endsOn: "2026-11-15", reason: "Diwali" }];
    // The night before keeps its window until 1 AM on the holiday
    expect(open(hours, ist("2026-11-14T00:30"), closures).openNow).toBe(true);
    const holiday = open(hours, ist("2026-11-14T12:00"), closures);
    expect(holiday).toMatchObject({ openNow: false, closedBy: "closure" });
    expect(holiday.opensAt).toBe(ist("2026-11-16T06:00").toISOString());
    // A 24 hour store closes at midnight before a holiday
    const allDay = open([], ist("2026-11-13T20:00"), closures);
    expect(allDay.closesAt).toBe(ist("2026-11-14T00:00").toISOString());
  });
});

describe("coverage", () => {
  const noida = { lat: 28.6208, lng: 77.3649 };
  const now = ist("2026-11-13T12:00");

  it("uses the radius when no pincodes are set up or none is sent", () => {
    const radius = coveringCandidates(
      seedWarehouses,
      emptySetup(),
      { ...noida, pincode: "201301" },
      now,
    );
    expect(radius.matchedBy).toBe("radius");
    expect(radius.candidates.map((c) => c.warehouse.id)).toEqual(["wh-noida-62"]);

    const setup = emptySetup();
    setup.pincodes.set("wh-noida-62", new Set(["201301"]));
    expect(coveringCandidates(seedWarehouses, setup, noida, now).matchedBy).toBe("radius");
  });

  it("lets the pincode decide once pincodes exist: listed is served even far away, unlisted is not", () => {
    const setup = emptySetup();
    setup.pincodes.set("wh-indiranagar", new Set(["560038"]));
    setup.pincodes.set("wh-noida-62", new Set(["201301"]));
    // Coordinates in Noida but a Bengaluru pincode: the pincode wins
    const listed = coveringCandidates(seedWarehouses, setup, { ...noida, pincode: "560038" }, now);
    expect(listed).toMatchObject({ matchedBy: "pincode" });
    expect(listed.candidates.map((c) => c.warehouse.id)).toEqual(["wh-indiranagar"]);
    // Inside the Noida radius but an unlisted pincode: not served
    const unlisted = coveringCandidates(
      seedWarehouses,
      setup,
      { ...noida, pincode: "110001" },
      now,
    );
    expect(unlisted.candidates).toEqual([]);
  });

  it("reports the soonest opening among closed warehouses", () => {
    const setup = emptySetup();
    setup.hours.set("wh-noida-62", everyDay("06:00", "01:00"));
    const { candidates } = coveringCandidates(
      seedWarehouses,
      setup,
      noida,
      ist("2026-11-13T03:00"),
    );
    expect(candidates[0]?.status.openNow).toBe(false);
    expect(soonestOpening(candidates)).toBe(ist("2026-11-13T06:00").toISOString());
  });

  it("cleans pincodes typed by a person", () => {
    expect(normalisePincodes([" 201301", "201309", "201301", ""])).toEqual(["201301", "201309"]);
  });
});
