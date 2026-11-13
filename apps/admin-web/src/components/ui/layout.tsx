import { ChevronRight } from "./icons";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./core";

export interface Crumb {
  label: string;
  href?: string;
}

/** Breadcrumbs, the title, a one-line description, and the page's main actions. */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  badge,
}: {
  title: ReactNode;
  description?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {crumbs && crumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex flex-wrap items-center gap-1 text-[13px] text-muted"
        >
          {crumbs.map((c, i) => (
            <span key={`${c.label}${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 text-faint" aria-hidden />}
              {c.href ? (
                <Link href={c.href} className="hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span className="text-ink-2">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold leading-8 tracking-tight text-ink">{title}</h1>
            {badge}
          </div>
          {description && <div className="mt-0.5 max-w-3xl text-sm text-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Link tabs: the current one is underlined. */
export function Tabs({
  tabs,
  current,
}: {
  tabs: { id: string; label: string; href: string; count?: number }[];
  current: string;
}) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          role="tab"
          aria-selected={t.id === current}
          className={cn(
            "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
            t.id === current
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="tnum rounded-full bg-surface-2 px-1.5 text-xs text-muted">
              {t.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

/** A row of filters above a table. */
export const Toolbar = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">{children}</div>
);

/** Segmented links: one of a few options, as links (so the page stays server-rendered). */
export function Segmented({
  options,
  current,
}: {
  options: { id: string; label: string; href: string; count?: number }[];
  current: string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-[13px]">
      {options.map((o) => (
        <Link
          key={o.id}
          href={o.href}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition-colors",
            o.id === current
              ? "bg-surface text-ink shadow-card ring-1 ring-line"
              : "text-muted hover:text-ink",
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className="tnum ml-1.5 text-xs text-faint">{o.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

/** A month heading with previous and next links. */
export function MonthNav({ month, href }: { month: string; href: (m: string) => string }) {
  const [y = 1970, m = 1] = month.split("-").map(Number);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const arrow =
    "inline-flex size-8 items-center justify-center rounded-md border border-line-strong bg-surface text-ink-2 shadow-card hover:bg-surface-2";
  return (
    <div className="flex items-center gap-2">
      <Link className={arrow} href={href(shift(-1))} aria-label="Previous month">
        ←
      </Link>
      <span className="min-w-36 text-center text-sm font-semibold text-ink">{label}</span>
      <Link className={arrow} href={href(shift(1))} aria-label="Next month">
        →
      </Link>
    </div>
  );
}

export const thisMonth = () => new Date().toISOString().slice(0, 7);
export const validMonth = (m: string | undefined) =>
  m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : thisMonth();
export const monthEnd = (month: string) => {
  const [y = 1970, m = 1] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};
