"use client";

import { Check, ChevronDown, Search, X } from "./icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { startNavigation } from "@/components/shell/NavProgress";
import { cn } from "./core";

export interface FilterOption {
  value: string;
  label: string;
  /** How many items match, shown beside it. */
  count?: number;
  /** Indented under the one above (a subcategory). */
  nested?: boolean;
  hint?: string;
}

/** The address with one parameter set (or removed), and the page number dropped: a new filter starts at page 1. */
function withParam(sp: URLSearchParams, key: string, value: string | null) {
  const next = new URLSearchParams(sp.toString());
  if (value) next.set(key, value);
  else next.delete(key);
  next.delete("page");
  return next;
}

/** One filter as a button that opens a small searchable list; choosing applies it at once (no Filter button) by changing the address. */
export function FilterMenu({
  param,
  label,
  options,
  current,
  searchable = false,
  width = "w-72",
}: {
  param: string;
  label: string;
  options: FilterOption[];
  current: string | null;
  searchable?: boolean;
  width?: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [, go] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const chosen = options.find((o) => o.value === current);
  const shown = q
    ? options.filter((o) => `${o.label} ${o.value}`.toLowerCase().includes(q.toLowerCase()))
    : options;
  const choose = (value: string | null) => {
    setOpen(false);
    setQ("");
    startNavigation();
    go(() =>
      router.push(
        `${path}?${withParam(new URLSearchParams(sp.toString()), param, value)}`.replace(/\?$/, ""),
      ),
    );
  };
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
          chosen
            ? "border-accent-line bg-accent-soft text-accent"
            : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
        )}
      >
        <span className={chosen ? "font-medium" : ""}>
          {chosen ? chosen.label.replace(/^\u00a0+/, "") : label}
        </span>
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-full left-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface shadow-pop",
            width,
          )}
          role="listbox"
          aria-label={label}
        >
          {searchable && (
            <div className="relative border-b border-line p-2">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                aria-label={`Search ${label}`}
                className="h-8 w-full rounded-md bg-surface-2 pr-2 pl-8 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          )}
          <ul className="max-h-72 overflow-y-auto p-1">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!current}
                onClick={() => choose(null)}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm text-ink-2 hover:bg-surface-2"
              >
                <span>All {label.toLowerCase()}</span>
                {!current && <Check className="size-4 text-accent" aria-hidden />}
              </button>
            </li>
            {shown.length === 0 && (
              <li className="px-2.5 py-3 text-[13px] text-muted">Nothing matches.</li>
            )}
            {shown.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === current}
                  onClick={() => choose(o.value)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-surface-2",
                    o.nested ? "pl-6 text-ink-2" : "font-medium text-ink",
                  )}
                >
                  <span className="min-w-0 truncate">
                    {o.hint && (
                      <span className="mr-1.5 font-mono text-[11px] text-faint">{o.hint}</span>
                    )}
                    {o.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {o.count !== undefined && (
                      <span className="tnum text-xs text-muted">{o.count}</span>
                    )}
                    {o.value === current && <Check className="size-4 text-accent" aria-hidden />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The search box: applies as you pause typing (and on Enter), keeping every other filter. */
export function SearchFilter({
  placeholder,
  className,
}: {
  placeholder: string;
  className?: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [text, setText] = useState(sp.get("q") ?? "");
  const [, go] = useTransition();
  const last = useRef(sp.get("q") ?? "");
  useEffect(() => {
    if (text === last.current) return;
    const t = setTimeout(() => {
      last.current = text;
      startNavigation();
      go(() =>
        router.push(
          `${path}?${withParam(new URLSearchParams(sp.toString()), "q", text.trim() || null)}`.replace(
            /\?$/,
            "",
          ),
        ),
      );
    }, 350);
    return () => clearTimeout(t);
  }, [text, path, router, sp]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    last.current = text;
    startNavigation();
    go(() =>
      router.push(
        `${path}?${withParam(new URLSearchParams(sp.toString()), "q", text.trim() || null)}`.replace(
          /\?$/,
          "",
        ),
      ),
    );
  };
  return (
    <form onSubmit={submit} role="search" className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-8 pl-9 text-sm text-ink shadow-card placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText("")}
          aria-label="Clear the search"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"
        >
          <X className="size-4" />
        </button>
      )}
    </form>
  );
}

/** The filters in force as chips you can remove one by one, and a clear-all. */
export function ActiveFilters({
  chips,
}: {
  chips: { param: string; label: string; value: string }[];
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  if (chips.length === 0) return null;
  const drop = (param: string) => {
    startNavigation();
    router.push(
      `${path}?${withParam(new URLSearchParams(sp.toString()), param, null)}`.replace(/\?$/, ""),
    );
  };
  const clear = () => {
    startNavigation();
    const n = new URLSearchParams(sp.toString());
    for (const c of chips) n.delete(c.param);
    n.delete("page");
    router.push(`${path}?${n}`.replace(/\?$/, ""));
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
      <span className="text-xs text-muted">Showing</span>
      {chips.map((c) => (
        <span
          key={c.param}
          className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 py-0.5 pr-1 pl-2.5 text-xs text-ink-2"
        >
          <span className="text-muted">{c.label}:</span>{" "}
          <span className="font-medium text-ink">{c.value}</span>
          <button
            type="button"
            onClick={() => drop(c.param)}
            aria-label={`Remove the ${c.label} filter`}
            className="rounded-full p-0.5 text-muted hover:bg-line hover:text-ink"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={clear}
        className="text-xs font-medium text-accent hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
