/** The date in India (UTC+5:30) as YYYY-MM-DD, `offsetDays` days from today. */
export function indiaDay(offsetDays = 0, now: Date = new Date()): string {
  const local = new Date(now.getTime() + 5.5 * 3600_000 + offsetDays * 86_400_000);
  return local.toISOString().slice(0, 10);
}

export const RANGES = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
] as const;
export type RangeKey = (typeof RANGES)[number]["key"];

export function rangeFor(key: RangeKey, now: Date = new Date()): { from: string; to: string } {
  const days = RANGES.find((r) => r.key === key)?.days ?? 7;
  return { from: indiaDay(-(days - 1), now), to: indiaDay(0, now) };
}

export const shortDate = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export const joinedDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
