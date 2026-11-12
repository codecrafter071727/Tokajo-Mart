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

export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      {children}
    </p>
  );
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-line bg-white">{children}</div>;
}

export const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-500";
export const td = "px-4 py-3 text-sm";
