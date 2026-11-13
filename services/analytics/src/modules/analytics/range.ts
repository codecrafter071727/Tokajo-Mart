/** India has no daylight saving, so a fixed offset is exact. */
const IST_OFFSET_MS = 5.5 * 3600_000;
export const DEFAULT_DAYS = 30;
export const MAX_DAYS = 366;

export class RangeError400 extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "RangeError400";
  }
}

export type ReportRange = {
  from: string;
  to: string;
  days: number;
  /** Midnight at the start of `from`, India time */
  start: Date;
  /** Midnight after `to`, India time (exclusive) */
  end: Date;
};

/** The India calendar day a moment falls on, as YYYY-MM-DD. */
export function indiaDay(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

const dayStart = (day: string) => new Date(Date.parse(`${day}T00:00:00.000Z`) - IST_OFFSET_MS);
const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Turns the optional from and to of a request into a checked range of whole India days. */
export function resolveRange(input: { from?: string; to?: string }, now: Date): ReportRange {
  const to = input.to ?? indiaDay(now);
  const from = input.from ?? addDays(to, -(DEFAULT_DAYS - 1));
  for (const value of [from, to]) {
    if (Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) || addDays(value, 0) !== value) {
      throw new RangeError400(`${value} is not a real date.`);
    }
  }
  if (from > to) throw new RangeError400("The start date is after the end date.");
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (days > MAX_DAYS) throw new RangeError400(`Pick a range of at most ${MAX_DAYS} days.`);
  return { from, to, days, start: dayStart(from), end: dayStart(addDays(to, 1)) };
}
