"use client";

import { Check, ChevronDown, Search } from "./icons";
import { useEffect, useRef, useState } from "react";
import { cn } from "./core";

export interface ComboOption {
  value: string;
  label: string;
  /** A small prefix such as an id. */
  hint?: string;
  /** Shown above the option, once per run of the same group. */
  group?: string;
}

/** A field you can type into to narrow a long list, then pick from. The chosen value is sent in a hidden field named `name`. */
export function Combo({
  name,
  options,
  placeholder = "Choose…",
  required,
}: {
  name: string;
  options: ComboOption[];
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [value, setValue] = useState("");
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
  const chosen = options.find((o) => o.value === value);
  const shown = q
    ? options.filter((o) =>
        `${o.label} ${o.hint ?? ""} ${o.group ?? ""}`.toLowerCase().includes(q.toLowerCase()),
      )
    : options;
  let last = "";
  return (
    <div ref={box} className="relative">
      <input
        type="text"
        name={name}
        value={value}
        required={required}
        readOnly
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        onFocus={() => setOpen(true)}
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-3 text-left text-sm shadow-card transition-colors hover:bg-surface-2",
          open && "border-accent ring-2 ring-accent/20",
        )}
      >
        <span className={cn("truncate", chosen ? "text-ink" : "text-faint")}>
          {chosen ? (
            <>
              {chosen.hint && (
                <span className="mr-1.5 font-mono text-[11px] text-faint">{chosen.hint}</span>
              )}
              {chosen.label}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div
          className="absolute top-full right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
          role="listbox"
        >
          <div className="relative border-b border-line p-2">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to narrow the list…"
              aria-label="Search the list"
              className="h-8 w-full rounded-md bg-surface-2 pr-2 pl-8 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto p-1">
            {shown.length === 0 && (
              <li className="px-2.5 py-3 text-[13px] text-muted">Nothing matches.</li>
            )}
            {shown.map((o) => {
              const head = o.group && o.group !== last ? o.group : null;
              last = o.group ?? last;
              return (
                <li key={o.value}>
                  {head && (
                    <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                      {head}
                    </div>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    onClick={() => {
                      setValue(o.value);
                      setOpen(false);
                      setQ("");
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-2"
                  >
                    <span className="min-w-0 truncate">
                      {o.hint && (
                        <span className="mr-1.5 font-mono text-[11px] text-faint">{o.hint}</span>
                      )}
                      {o.label}
                    </span>
                    {o.value === value && (
                      <Check className="size-4 shrink-0 text-accent" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
