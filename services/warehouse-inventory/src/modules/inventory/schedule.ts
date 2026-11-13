import type { OpenStatus, OpeningWindow } from "@qc/contracts";
import { distanceKm, type Warehouse } from "./domain";

/**
 * Opening hours and service areas. Everything here is pure and works in India time (UTC+5:30, no
 * daylight saving), because that is the time on the warehouse wall clock.
 */

const IST_OFFSET_MIN = 330;
const DAY_MS = 86_400_000;
/** How far ahead to look for the next opening. A week plus a day covers any weekly pattern. */
const LOOKAHEAD_DAYS = 9;

export type ClosureRange = {
  id: string;
  startsOn: string;
  endsOn: string;
  reason: string;
  createdAt?: string;
};

/** What decides when and where each warehouse serves. Empty maps keep the old behaviour. */
export type ServiceSetup = {
  /** Pincodes a warehouse serves. A warehouse with none is matched by distance only. */
  pincodes: Map<string, Set<string>>;
  /** Weekly windows. A warehouse with none is open all day, every day. */
  hours: Map<string, OpeningWindow[]>;
  /** Whole days it is shut (holidays) */
  closures: Map<string, ClosureRange[]>;
};

export const emptySetup = (): ServiceSetup => ({
  pincodes: new Map(),
  hours: new Map(),
  closures: new Map(),
});

/** The India calendar day (YYYY-MM-DD) and weekday of a moment. */
export function indiaDay(at: Date): { day: string; weekday: number } {
  const local = new Date(at.getTime() + IST_OFFSET_MIN * 60_000);
  return { day: local.toISOString().slice(0, 10), weekday: local.getUTCDay() };
}

/** The UTC moment of a wall clock time ("HH:MM", or minutes) on an India calendar day. */
function atIndia(day: string, minutes: number): Date {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + (minutes - IST_OFFSET_MIN) * 60_000);
}

const toMinutes = (clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) + n * DAY_MS).toISOString().slice(0, 10);

const closedOn = (day: string, closures: ClosureRange[]) =>
  closures.some((c) => c.startsOn <= day && day <= c.endsOn);

type Interval = { start: number; end: number };

/** The concrete open intervals around a moment: from yesterday (overnight spill) a week ahead. */
function openIntervals(hours: OpeningWindow[], closures: ClosureRange[], now: Date): Interval[] {
  const today = indiaDay(now).day;
  const byWeekday = new Map(hours.map((h) => [h.weekday, h]));
  const intervals: Interval[] = [];
  for (let offset = -1; offset <= LOOKAHEAD_DAYS; offset += 1) {
    const day = addDays(today, offset);
    // An interval belongs to the day it opens: a holiday cancels that day's opening
    if (closedOn(day, closures)) continue;
    const weekday = new Date(`${day}T00:00:00.000Z`).getUTCDay();
    if (hours.length === 0) {
      intervals.push({ start: atIndia(day, 0).getTime(), end: atIndia(day, 1440).getTime() });
      continue;
    }
    const window = byWeekday.get(weekday);
    if (!window) continue;
    const opens = toMinutes(window.opensAt);
    let closes = toMinutes(window.closesAt);
    if (closes <= opens) closes += 1440; // closes after midnight
    intervals.push({ start: atIndia(day, opens).getTime(), end: atIndia(day, closes).getTime() });
  }
  intervals.sort((a, b) => a.start - b.start);
  // Join back to back windows (a 24 hour store, or a window that runs into the next day's)
  const merged: Interval[] = [];
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

/**
 * Is the warehouse taking orders at this moment, and if not, when does it open next. A warehouse
 * switched off by hand stays closed with no opening time until someone switches it back on.
 */
export function openStatus(
  input: { manualOpen: boolean; hours: OpeningWindow[]; closures: ClosureRange[] },
  now: Date,
): OpenStatus {
  if (!input.manualOpen)
    return { openNow: false, opensAt: null, closesAt: null, closedBy: "manual" };
  const t = now.getTime();
  const intervals = openIntervals(input.hours, input.closures, now);
  const current = intervals.find((i) => i.start <= t && t < i.end);
  const horizon = atIndia(addDays(indiaDay(now).day, LOOKAHEAD_DAYS), 0).getTime();
  if (current) {
    // A window that runs to the edge of what we looked at never closes in practice (24 x 7)
    const closesAt = current.end >= horizon ? null : new Date(current.end).toISOString();
    return { openNow: true, opensAt: null, closesAt, closedBy: null };
  }
  const next = intervals.find((i) => i.start > t);
  return {
    openNow: false,
    opensAt: next ? new Date(next.start).toISOString() : null,
    closesAt: null,
    closedBy: closedOn(indiaDay(now).day, input.closures) ? "closure" : "hours",
  };
}

export function statusOf(warehouse: Warehouse, setup: ServiceSetup, now: Date): OpenStatus {
  return openStatus(
    {
      manualOpen: warehouse.open,
      hours: setup.hours.get(warehouse.id) ?? [],
      closures: setup.closures.get(warehouse.id) ?? [],
    },
    now,
  );
}

export type Candidate = { warehouse: Warehouse; distanceKm: number; status: OpenStatus };

/**
 * Which warehouses cover a place, nearest first. With a pincode, and once any warehouse lists
 * pincodes, the pincode decides: a listed pincode is served even past the radius, and an unlisted
 * one is not served at all. Without a pincode (or with no pincodes set up) the radius decides.
 */
export function coveringCandidates(
  warehouses: Warehouse[],
  setup: ServiceSetup,
  place: { lat: number; lng: number; pincode?: string },
  now: Date,
): { matchedBy: "pincode" | "radius"; candidates: Candidate[] } {
  const anyPincodes = [...setup.pincodes.values()].some((set) => set.size > 0);
  const byPincode = Boolean(place.pincode) && anyPincodes;
  const candidates = warehouses
    .map((warehouse) => ({
      warehouse,
      distanceKm: distanceKm(place.lat, place.lng, warehouse.lat, warehouse.lng),
    }))
    .filter((entry) =>
      byPincode
        ? (setup.pincodes.get(entry.warehouse.id)?.has(place.pincode as string) ?? false)
        : entry.distanceKm <= entry.warehouse.radiusKm,
    )
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .map((entry) => ({ ...entry, status: statusOf(entry.warehouse, setup, now) }));
  return { matchedBy: byPincode ? "pincode" : "radius", candidates };
}

/** The soonest opening among closed candidates, as an ISO time, or null. */
export function soonestOpening(candidates: Candidate[]): string | null {
  const times = candidates.map((c) => c.status.opensAt).filter((t): t is string => t !== null);
  return times.length === 0 ? null : (times.sort()[0] as string);
}

/** Pincodes as entered by a person: any separators, duplicates dropped, sorted. */
export function normalisePincodes(pincodes: string[]): string[] {
  return [...new Set(pincodes.map((p) => p.trim()).filter(Boolean))].sort();
}
