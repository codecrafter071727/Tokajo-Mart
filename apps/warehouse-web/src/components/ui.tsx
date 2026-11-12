import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-700">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red" | "gray" | "blue";
  children: ReactNode;
}) {
  const tones = {
    green: "bg-brand-100 text-brand-900",
    amber: "bg-amber-100 text-amber-900",
    red: "bg-red-100 text-red-800",
    gray: "bg-surface text-ink-700",
    blue: "bg-blue-100 text-blue-900",
  } as const;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
    >
      {children}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-ink-500">
      {children}
    </p>
  );
}

export const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-500";
export const td = "px-4 py-3 text-sm";
