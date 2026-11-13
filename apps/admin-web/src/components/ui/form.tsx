import type { ComponentProps, ReactNode } from "react";
import { cn } from "./core";

const INPUT =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-card placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-surface-2 disabled:text-muted";

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[13px] font-medium text-ink-2">
        {label}
        {required && <span className="text-bad"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  );
}

export const Input = ({ className, ...p }: ComponentProps<"input">) => (
  <input {...p} className={cn(INPUT, "h-9", className)} />
);
export const Textarea = ({ className, ...p }: ComponentProps<"textarea">) => (
  <textarea {...p} className={cn(INPUT, "min-h-20 py-2", className)} />
);
export function Select({
  className,
  options,
  ...p
}: ComponentProps<"select"> & { options: { value: string; label: string }[] }) {
  return (
    <select {...p} className={cn(INPUT, "h-9 pr-8", className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Check({ label, className, ...p }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-2",
        className,
      )}
    >
      <input
        type="checkbox"
        {...p}
        className="size-4 rounded border-line-strong text-accent accent-[var(--color-accent)]"
      />
      {label}
    </label>
  );
}

/** Mon..Sun checkboxes named day1..day7 (1 = Monday). */
export function Weekdays({
  defaults = [1, 2, 3, 4, 5, 6, 7],
  prefix = "day",
}: {
  defaults?: number[];
  prefix?: string;
}) {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {names.map((n, i) => (
        <label key={n} className="cursor-pointer">
          <input
            type="checkbox"
            name={`${prefix}${i + 1}`}
            defaultChecked={defaults.includes(i + 1)}
            className="peer sr-only"
          />
          <span className="inline-flex h-8 min-w-11 items-center justify-center rounded-md border border-line-strong bg-surface px-2 text-[13px] text-muted peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
            {n}
          </span>
        </label>
      ))}
    </div>
  );
}

export const FormGrid = ({
  cols = 2,
  className,
  children,
}: {
  cols?: 1 | 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "grid gap-4",
      cols === 2 && "sm:grid-cols-2",
      cols === 3 && "sm:grid-cols-3",
      cols === 4 && "sm:grid-cols-2 lg:grid-cols-4",
      className,
    )}
  >
    {children}
  </div>
);
