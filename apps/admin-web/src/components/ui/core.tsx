import Link from "next/link";
import type { IconComponent as LucideIcon } from "./icons";
import { buttonClass, type Size, type Variant } from "./button-style";
import type { ComponentProps, ReactNode } from "react";

/** cn: join class names, skipping empty ones. */
export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ── Buttons ──
export { Button } from "./button";
export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...p
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...p} className={buttonClass(variant, size, className)} />;
}

// ── Badge: always text, tone for emphasis ──
export type Tone = "neutral" | "ok" | "warn" | "bad" | "info" | "accent";
const TONE: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  ok: "bg-ok-soft text-ok border-ok-line",
  warn: "bg-warn-soft text-warn border-warn-line",
  bad: "bg-bad-soft text-bad border-bad-line",
  info: "bg-info-soft text-info border-info-line",
  accent: "bg-accent-soft text-accent border-accent-line",
};
const DOT: Record<Tone, string> = {
  neutral: "bg-faint",
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
  info: "bg-info",
  accent: "bg-accent",
};

export function Badge({
  tone = "neutral",
  dot = true,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium leading-5 whitespace-nowrap",
        TONE[tone],
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", DOT[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<string, Tone> = {
  live: "ok",
  published: "ok",
  open: "ok",
  active: "ok",
  confirmed: "ok",
  draft: "neutral",
  paused: "warn",
  archived: "neutral",
  closed: "bad",
  expired: "neutral",
  sold_out: "bad",
  low: "warn",
};
export const StatusBadge = ({ status }: { status: string }) => (
  <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>
);

// ── Card ──
export function Card({
  title,
  description,
  actions,
  children,
  className,
  flush,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section
      className={cn("min-w-0 rounded-xl border border-line bg-surface shadow-card", className)}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {description && <div className="mt-0.5 text-[13px] text-muted">{description}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

// ── Callout ──
const CALLOUT: Record<"ok" | "warn" | "bad" | "info", string> = {
  ok: "border-ok-line bg-ok-soft text-ok",
  warn: "border-warn-line bg-warn-soft text-warn",
  bad: "border-bad-line bg-bad-soft text-bad",
  info: "border-info-line bg-info-soft text-info",
};
export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "ok" | "warn" | "bad" | "info";
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={cn("rounded-lg border px-4 py-3 text-[13px]", CALLOUT[tone])}
    >
      {title && <div className="font-semibold">{title}</div>}
      {children && <div className={cn(title && "mt-0.5", "text-ink-2")}>{children}</div>}
    </div>
  );
}

/** The result of the last action, from ?ok= or ?error= in the address. */
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div className="mb-5">
      <Callout tone={error ? "bad" : "ok"}>{error ?? ok}</Callout>
    </div>
  );
}

// ── Stat: a metric card, as on the reference dashboard (title, icon tile, big number, a change or hint) ──
export function Stat({
  label,
  value,
  hint,
  tone,
  href,
  icon: Icon,
  delta,
  deltaTone = "neutral",
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  href?: string;
  icon?: LucideIcon;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
  delay?: number;
}) {
  const body = (
    <div
      className={cn(
        "rise group relative h-full overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-card transition-colors",
        href && "hover:border-accent/50",
      )}
      style={{ animationDelay: `${delay * 80}ms` }}
    >
      <div className="relative">
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="text-[13px] font-medium text-muted">{label}</span>
          {Icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted transition-colors group-hover:bg-accent-soft group-hover:text-accent">
              <Icon className="size-4" aria-hidden />
            </span>
          )}
        </div>
        <div className="flex items-end gap-3">
          <span className="tnum text-2xl font-bold leading-none tracking-tight text-ink lg:text-[30px]">
            {value}
          </span>
          {delta && (
            <span
              className={cn(
                "mb-0.5 text-[13px] font-medium",
                deltaTone === "up" && "text-ok",
                deltaTone === "down" && "text-bad",
                deltaTone === "neutral" && "text-muted",
              )}
            >
              {delta}
            </span>
          )}
          {tone && !delta && (
            <span className={cn("mb-1 size-2 rounded-full", DOT[tone])} aria-hidden />
          )}
        </div>
        {hint && <div className="mt-2 text-xs text-muted">{hint}</div>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

// ── Empty state ──
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-2 text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {children && <p className="mt-1 max-w-md text-[13px] text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Utilisation bar: sold and held out of capacity ──
export function Meter({
  sold,
  held = 0,
  capacity,
  className,
}: {
  sold: number;
  held?: number;
  capacity: number;
  className?: string;
}) {
  const pct = (n: number) => (capacity > 0 ? Math.min(100, (n / capacity) * 100) : 0);
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line",
        className,
      )}
      role="img"
      aria-label={`${sold} sold, ${held} held of ${capacity}`}
    >
      <div className="flex h-full">
        <div className="bg-accent" style={{ width: `${pct(sold)}%` }} />
        <div className="bg-warn/60" style={{ width: `${pct(held)}%` }} />
      </div>
    </div>
  );
}

/** A label and its value, in a definition list. */
export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-[13px]">
      {items.map((i) => (
        <div key={i.label} className="contents">
          <dt className="text-muted">{i.label}</dt>
          <dd className="min-w-0 text-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const Mono = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[12px] text-ink-2">{children}</span>
);
