import type { ButtonHTMLAttributes, ReactNode } from "react";

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

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-line bg-white">{children}</div>;
}

export const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-500";
export const td = "px-4 py-3 text-sm";

// ---------------------------------------------------------------------------------------------
// Shared building blocks for forms, dialogs and states
// ---------------------------------------------------------------------------------------------

export const inputCls =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-surface disabled:text-ink-500";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  small?: boolean;
};

export function Button({
  variant = "secondary",
  small,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  const styles = {
    primary: "bg-brand-600 text-ink-900 font-extrabold hover:bg-brand-500",
    secondary: "border border-line bg-white text-ink-900 font-semibold hover:bg-surface",
    danger: "bg-red-600 text-white font-bold hover:bg-red-700",
    ghost: "text-brand-700 font-bold hover:bg-brand-50",
  } as const;
  return (
    <button
      type={type}
      {...rest}
      className={`rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
      } ${styles[variant]} ${className}`}
    />
  );
}

/** A labelled field with its error underneath. */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      {children}
      {hint && !error ? (
        <span className="mt-1 block text-xs font-normal text-ink-500">{hint}</span>
      ) : null}
      {error ? (
        <span role="alert" className="mt-1 block text-xs font-semibold text-red-700">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
}) {
  const tones = {
    error: "bg-red-50 text-red-800",
    success: "bg-brand-50 text-brand-900",
    info: "bg-blue-50 text-blue-900",
  } as const;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg px-4 py-3 text-sm font-semibold ${tones[tone]}`}
    >
      {children}
    </p>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td className={`${td} py-10 text-center text-ink-500`} colSpan={colSpan}>
        {children}
      </td>
    </tr>
  );
}

export function LoadingRows({ colSpan, rows = 4 }: { colSpan: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} className="border-b border-line last:border-0">
          <td className={td} colSpan={colSpan}>
            <div className="h-4 w-full animate-pulse rounded bg-surface" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-3">{children}</div>;
}
