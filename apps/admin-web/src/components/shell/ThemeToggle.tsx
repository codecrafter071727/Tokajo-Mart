"use client";

import { Check, Monitor, Moon, Sun } from "@/components/ui/icons";
import { cn } from "@/components/ui/core";
import { useEffect, useId, useRef, useState } from "react";

type Choice = "light" | "dark" | "system";
const KEY = "qc-admin-theme";

const OPTIONS: { value: Choice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function apply(choice: Choice) {
  const dark =
    choice === "dark" ||
    (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function readChoice(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* private window */
  }
  return "light";
}

/** Pick light, dark, or match the device. The root layout script applies the saved choice before paint. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [choice, setChoice] = useState<Choice>("light");
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = readChoice();
    setChoice(saved);
    apply(saved);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readChoice() === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (next: Choice) => {
    setChoice(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* not kept */
    }
    apply(next);
    setOpen(false);
  };

  const current = OPTIONS.find((o) => o.value === choice) ?? OPTIONS[0];
  const Icon = current.icon;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Appearance: ${current.label}. Change theme`}
        title={`Appearance (${current.label})`}
        className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Icon className="size-[18px]" aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Appearance"
          className="absolute top-full right-0 z-50 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-pop"
        >
          <p className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
            Appearance
          </p>
          {OPTIONS.map((opt) => {
            const OptIcon = opt.icon;
            const on = choice === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => pick(opt.value)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2",
                  on ? "text-ink" : "text-ink-2",
                )}
              >
                <OptIcon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{opt.label}</span>
                {on ? <Check className="size-4 shrink-0 text-accent" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
