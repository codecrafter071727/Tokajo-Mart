"use client";

import { ChevronLeft, ChevronRight, X } from "./icons";
import { useMemo, useState } from "react";
import { cn } from "./core";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const label = (s: string, year = false) =>
  new Date(`${s}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });

/** A month of days, Monday first. Days before `min` are greyed and cannot be picked. The caller decides what a click means. */
function Month({
  start,
  onStart,
  pick,
  state,
  min,
}: {
  start: string;
  onStart: (s: string) => void;
  pick: (d: string) => void;
  state: (d: string) => "none" | "on" | "edge" | "in";
  min: string;
}) {
  const [y = 1970, m = 1] = start.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    onStart(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`);
  };
  const cells: (string | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => ymd(y, m - 1, i + 1)),
  ];
  const arrow =
    "inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink";
  return (
    <div className="w-full max-w-[19rem] select-none">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className={arrow}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold text-ink">
          {first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}
        </span>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className={arrow}>
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center" role="grid">
        {WEEK.map((w) => (
          <div key={w} role="columnheader" className="pb-1 text-[11px] font-medium text-faint">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`b${i}`} />;
          const s = state(d);
          const past = d < min;
          return (
            <button
              key={d}
              type="button"
              disabled={past}
              onClick={() => pick(d)}
              aria-pressed={s === "on" || s === "edge"}
              aria-label={label(d, true)}
              className={cn(
                "mx-auto flex size-9 items-center justify-center text-[13px] tabular-nums transition-colors",
                s === "in" ? "w-full rounded-none bg-accent-soft text-accent" : "rounded-lg",
                (s === "on" || s === "edge") &&
                  "bg-accent font-semibold text-on-accent hover:bg-accent-hover",
                s === "none" && !past && "text-ink hover:bg-surface-2",
                past && "cursor-not-allowed text-faint/60",
              )}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const startOf = (s: string | undefined, min: string) => `${(s ?? min).slice(0, 7)}-01`;

/**
 * Pick any number of single days on a calendar (a departure on the 10th and the 24th, not every Saturday). The choice goes to the form
 * as one comma-separated field named `name` (YYYY-MM-DD), so the server action is the same as for a typed list.
 */
export function MultiDatePicker({
  name,
  defaultValue = [],
  min,
  hint,
}: {
  name: string;
  defaultValue?: string[];
  min: string;
  hint?: string;
}) {
  const [sel, setSel] = useState<string[]>([...new Set(defaultValue)].sort());
  const [month, setMonth] = useState(startOf(defaultValue[0], min));
  const set = useMemo(() => new Set(sel), [sel]);
  const toggle = (d: string) =>
    setSel((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));
  const addAll = (dow: number) => {
    const [y = 1970, m = 1] = month.split("-").map(Number);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const add = Array.from({ length: days }, (_, i) => ymd(y, m - 1, i + 1)).filter(
      (d) => d >= min && (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7 === dow,
    );
    setSel((cur) => [...new Set([...cur, ...add])].sort());
  };
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <input type="hidden" name={name} value={sel.join(",")} />
      <div className="flex flex-col gap-5 sm:flex-row">
        <Month
          start={month}
          onStart={setMonth}
          pick={toggle}
          state={(d) => (set.has(d) ? "on" : "none")}
          min={min}
        />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-2">
              {sel.length === 0
                ? "No dates yet"
                : `${sel.length} date${sel.length === 1 ? "" : "s"} chosen`}
            </span>
            {sel.length > 0 && (
              <button
                type="button"
                onClick={() => setSel([])}
                className="text-xs text-muted hover:text-ink"
              >
                Clear all
              </button>
            )}
          </div>
          {sel.length === 0 ? (
            <p className="text-[13px] text-muted">
              {hint ?? "Click days on the calendar. Click a chosen day again to remove it."}
            </p>
          ) : (
            <ul className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
              {sel.map((d) => (
                <li
                  key={d}
                  className="inline-flex items-center gap-1 rounded-full border border-accent-line bg-accent-soft py-0.5 pr-1 pl-2.5 text-xs font-medium text-accent"
                >
                  {label(d)}
                  <button
                    type="button"
                    onClick={() => toggle(d)}
                    aria-label={`Remove ${label(d, true)}`}
                    className="rounded-full p-0.5 hover:bg-accent/15"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 border-t border-line pt-3">
            <span className="mb-1.5 block text-xs text-muted">Add every … in the month shown</span>
            <div className="flex flex-wrap gap-1">
              {WEEK.map((w, i) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => addAll(i)}
                  className="rounded-md border border-line-strong bg-surface px-2 py-1 text-xs text-ink-2 hover:bg-surface-2"
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pick a stretch of days: click the first, then the last. Goes to the form as two fields, `from` and `to` (YYYY-MM-DD). */
export function RangePicker({
  from,
  to,
  defaultFrom,
  defaultTo,
  min,
}: {
  from: string;
  to: string;
  defaultFrom?: string;
  defaultTo?: string;
  min: string;
}) {
  const [a, setA] = useState<string | null>(defaultFrom ?? null);
  const [b, setB] = useState<string | null>(defaultTo ?? defaultFrom ?? null);
  const [month, setMonth] = useState(startOf(defaultFrom, min));
  const pick = (d: string) => {
    if (!a || b) {
      setA(d);
      setB(null);
      return;
    }
    if (d < a) {
      setB(a);
      setA(d);
    } else setB(d);
  };
  const state = (d: string): "none" | "on" | "edge" | "in" => {
    if (!a) return "none";
    const end = b ?? a;
    if (d === a || d === end) return "edge";
    return d > a && d < end ? "in" : "none";
  };
  const days = a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1 : 0;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <input type="hidden" name={from} value={a ?? ""} />
      <input type="hidden" name={to} value={b ?? a ?? ""} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Month start={month} onStart={setMonth} pick={pick} state={state} min={min} />
        <div className="text-[13px]">
          <div className="text-muted">From</div>
          <div className="mb-3 font-medium text-ink">
            {a ? label(a, true) : "Click the first day"}
          </div>
          <div className="text-muted">To</div>
          <div className="mb-3 font-medium text-ink">
            {b
              ? label(b, true)
              : a
                ? "Click the last day (the same day again for just one)"
                : "Not chosen yet"}
          </div>
          {days > 0 && (
            <div className="rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent">
              {days} day{days === 1 ? "" : "s"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
