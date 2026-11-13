import { indiaDay } from "../../lib/dates";

/** A stretch of India days, both ends included. */
export type DayRange = { from: string; to: string };

export const PRESETS = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
] as const;
export type PresetKey = (typeof PRESETS)[number]["key"];

/** The analytics service refuses longer ranges. */
export const MAX_DAYS = 366;

const DAY_MS = 86_400_000;
const toMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const daysIn = (r: DayRange) => Math.round((toMs(r.to) - toMs(r.from)) / DAY_MS) + 1;

export function presetRange(key: PresetKey, now: Date = new Date()): DayRange {
  const days = PRESETS.find((p) => p.key === key)?.days ?? 30;
  return { from: indiaDay(-(days - 1), now), to: indiaDay(0, now) };
}

/** The range of the same length that ends the day before this one starts, for "vs before" figures. */
export function previousRange(r: DayRange): DayRange {
  const days = daysIn(r);
  const to = toMs(r.from) - DAY_MS;
  return { from: fromMs(to - (days - 1) * DAY_MS), to: fromMs(to) };
}

/** Keeps a picked range valid: in order, not in the future, and not longer than the service allows. */
export function clampRange(r: DayRange, today: string = indiaDay(0)): DayRange {
  let { from, to } = r.from <= r.to ? r : { from: r.to, to: r.from };
  if (to > today) to = today;
  if (from > to) from = to;
  if (daysIn({ from, to }) > MAX_DAYS) from = fromMs(toMs(to) - (MAX_DAYS - 1) * DAY_MS);
  return { from, to };
}

/**
 * Change against the period before, as a label and a direction. `better` says which way is good:
 * fewer cancellations or faster deliveries are improvements even though the number went down.
 */
export function change(
  now: number | null | undefined,
  before: number | null | undefined,
  better: "up" | "down" = "up",
): { delta?: string; deltaTone: "up" | "down" | "neutral" } {
  if (now == null || before == null || before === 0) return { deltaTone: "neutral" };
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  if (pct === 0) return { delta: "0%", deltaTone: "neutral" };
  const improved = better === "up" ? pct > 0 : pct < 0;
  return { delta: `${pct > 0 ? "+" : ""}${pct}%`, deltaTone: improved ? "up" : "down" };
}

export const mins = (m: number | null | undefined) =>
  m == null ? "No data" : `${Math.round(m)} min`;
export const pct = (p: number | null | undefined) => (p == null ? "No data" : `${Math.round(p)}%`);
export const count = (n: number) => n.toLocaleString("en-IN");

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const hourLabel = (h: number) => {
  const suffix = h < 12 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
};

type Cell = string | number | null | undefined;

/** One CSV cell: quoted when it holds a comma, quote or line break, and never read as a formula. */
export function csvCell(value: Cell): string {
  if (value == null) return "";
  let text = String(value);
  // A leading = + - @ makes spreadsheets run it as a formula
  if (typeof value === "string" && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Saves a table as a CSV file in the browser. Nothing goes to the server. */
export function downloadCsv(name: string, headers: string[], rows: Cell[][]): void {
  // The byte order mark makes Excel read the rupee sign and Indian names correctly
  const blob = new Blob(["﻿", toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Paise as plain rupees for a CSV, so a spreadsheet can add them up. */
export const csvRupees = (paise: number | null | undefined) =>
  paise == null ? "" : (paise / 100).toFixed(2);
