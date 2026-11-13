/** Times and money as the console shows them. Everything is India time. */

const TZ = "Asia/Kolkata";

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });

export const timeOnly = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });

export const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });

/** "just now", "12 min ago", "3 h ago", "2 days ago" */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** Minutes between two times, or until now */
export const minutesBetween = (fromIso: string, toIso?: string | null) =>
  Math.max(
    0,
    Math.round(((toIso ? Date.parse(toIso) : Date.now()) - Date.parse(fromIso)) / 60_000),
  );

/** "₹45.50" from "45.5" typed by an admin, as paise, or null when it is not a valid amount */
export function rupeesToPaise(text: string): number | null {
  const clean = text.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export const pluralise = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
