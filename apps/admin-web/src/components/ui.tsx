import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icons";

// ---------------------------------------------------------------------------------------------
// Page frame
// ---------------------------------------------------------------------------------------------

/** Id of the header slot that PageActions renders into */
export const ACTIONS_SLOT = "page-actions";

/** Title, one line of context and, on the right, the page's main actions. */
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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      <div id={ACTIONS_SLOT} className="flex shrink-0 items-center gap-2">
        {action}
      </div>
    </header>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border border-line bg-white shadow-card ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

/** Filters on the left, anything pushed right with ml-auto. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

// ---------------------------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------------------------

export type Tone = "green" | "amber" | "red" | "gray" | "blue";

const TONES: Record<Tone, { pill: string; dot: string }> = {
  green: { pill: "bg-brand-50 text-brand-900 ring-brand-200", dot: "bg-brand-600" },
  amber: { pill: "bg-amber-50 text-amber-900 ring-amber-200", dot: "bg-amber-500" },
  red: { pill: "bg-red-50 text-red-800 ring-red-200", dot: "bg-red-500" },
  gray: { pill: "bg-surface text-ink-700 ring-line-strong", dot: "bg-ink-300" },
  blue: { pill: "bg-blue-50 text-blue-900 ring-blue-200", dot: "bg-blue-500" },
};

/** Status label. Tones mean the same everywhere: blue new, amber in progress, green done, red problem, gray inactive. */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone].pill}`}
    >
      <span className={`size-1.5 rounded-full ${TONES[tone].dot}`} aria-hidden="true" />
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------------------------

/** The card around a table. Long tables scroll inside it so the header stays in view. */
export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="data-table max-h-[calc(100vh-13rem)] overflow-auto rounded-xl border border-line bg-white shadow-card">
      {children}
    </div>
  );
}

export const th =
  "whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500";
export const td = "px-4 py-3 text-sm align-middle";
/** Numbers line up on the right and use fixed width digits */
export const thNum = `${th} text-right`;
export const tdNum = `${td} text-right tabular-nums`;
/** The actions column sits on the right */
export const tdActions = `${td} text-right whitespace-nowrap`;

const AVATAR_COLOURS = [
  "bg-brand-100 text-brand-900",
  "bg-blue-100 text-blue-900",
  "bg-amber-100 text-amber-900",
  "bg-rose-100 text-rose-900",
  "bg-violet-100 text-violet-900",
  "bg-teal-100 text-teal-900",
];

/** Initials in a circle, coloured from the name so the same person always looks the same. */
export function Avatar({ name }: { name: string }) {
  const clean = name.trim() || "?";
  const initials = clean
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hash = [...clean].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return (
    <span
      aria-hidden="true"
      className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${AVATAR_COLOURS[hash % AVATAR_COLOURS.length]}`}
    >
      {initials}
    </span>
  );
}

/** A person in a table cell: avatar, name and one line underneath. */
export function PersonCell({
  name,
  detail,
  badge,
}: {
  name: string;
  detail?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-medium text-ink-900">
          <span className="truncate">{name}</span>
          {badge}
        </div>
        {detail ? <div className="truncate text-xs text-ink-500">{detail}</div> : null}
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center">
        <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface text-ink-500">
          <Icon name="inbox" />
        </span>
        <span className="text-sm text-ink-500">{children}</span>
      </td>
    </tr>
  );
}

export function LoadingRows({ colSpan, rows = 5 }: { colSpan: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} aria-hidden="true">
          {Array.from({ length: colSpan }, (_, j) => (
            <td key={j} className={td}>
              <div
                className="h-3.5 animate-pulse rounded bg-surface"
                style={{ width: `${j === 0 ? 70 : 40 + ((i * 7 + j * 13) % 40)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-white px-6 py-14 text-center">
      <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-brand-50 text-brand-700">
        <Icon name={icon} />
      </span>
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------------------------

const CONTROL =
  "rounded-lg border border-line-strong bg-white text-sm text-ink-900 shadow-[0_1px_1px_rgb(20_32_30/0.03)] placeholder:text-ink-300 focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-100 disabled:bg-surface disabled:text-ink-500";

/** Text inputs inside a Field (with the gap under the label) */
export const inputCls = `mt-1.5 block min-h-10 w-full px-3 py-2 ${CONTROL}`;
/** Free standing controls in a toolbar */
export const controlCls = `h-9 px-3 ${CONTROL}`;
export const selectCls = `h-9 pl-3 pr-8 font-medium ${CONTROL}`;

/** A search box with its icon. Pass the usual input props. */
export function SearchInput({
  className = "w-72",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <Icon
        name="search"
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
      />
      <input type="search" {...rest} className={`${controlCls} w-full pl-9`} />
    </span>
  );
}

/** A checkbox with its label, for toolbar toggles. */
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink-700 hover:bg-white">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded accent-brand-600"
      />
      {label}
    </label>
  );
}

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "subtle" | "dangerGhost";
export type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-ink-900 font-semibold shadow-[inset_0_-1px_0_rgb(0_0_0/0.08)] hover:bg-brand-500 active:bg-brand-600",
  secondary:
    "border border-line-strong bg-white text-ink-900 font-semibold shadow-[0_1px_1px_rgb(20_32_30/0.04)] hover:bg-surface",
  danger: "bg-red-600 text-white font-semibold hover:bg-red-700",
  ghost: "text-brand-700 font-semibold hover:bg-brand-50",
  subtle: "text-ink-700 font-semibold hover:bg-surface hover:text-ink-900",
  dangerGhost: "text-red-700 font-semibold hover:bg-red-50",
};

/** Class string for things that look like buttons but are links or plain elements. */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md") {
  return `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
    size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm"
  } ${VARIANTS[variant]}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  small?: boolean;
  icon?: IconName;
};

export function Button({
  variant = "secondary",
  small,
  icon,
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      className={`${
        // Small ghost buttons are row actions: quiet ink text, like rowAction
        small && variant === "ghost"
          ? rowAction
          : small && variant === "dangerGhost"
            ? rowActionDanger
            : buttonClass(variant, small ? "sm" : "md")
      } ${className}`}
    >
      {icon ? <Icon name={icon} size={small ? 14 : 16} /> : null}
      {children}
    </button>
  );
}

/** The button row at the bottom of a dialog: stays in view while a long form scrolls. */
export const dialogFooter =
  "sticky -bottom-5 -mx-6 -mb-5 mt-6 flex justify-end gap-2 border-t border-line bg-white px-6 py-4";

/** Row level actions: quiet text buttons, red for the destructive one. */
export const rowAction =
  "inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-surface hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-40";
export const rowActionDanger =
  "inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40";

/** A filter chip: rounded, green when selected. */
export function chipClass(active: boolean) {
  return `inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors ${
    active
      ? "bg-ink-900 text-white"
      : "border border-line-strong bg-white text-ink-700 hover:bg-surface hover:text-ink-900"
  }`;
}

/** A small set of mutually exclusive options, like a date range. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex h-9 items-center rounded-lg border border-line-strong bg-white p-0.5 shadow-[0_1px_1px_rgb(20_32_30/0.03)]"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-full rounded-md px-3 text-sm font-semibold transition-colors ${
            value === o.value ? "bg-ink-900 text-white" : "text-ink-700 hover:text-ink-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A card section with a title row and optional controls on the right. */
export function Panel({
  title,
  actions,
  children,
  flush,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  /** No padding around the body, for tables that run edge to edge */
  flush?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {actions}
      </div>
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

/** A labelled field with its hint or error underneath. */
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
    <label className="block text-sm font-medium text-ink-900">
      {label}
      {children}
      {hint && !error ? (
        <span className="mt-1 block text-xs font-normal text-ink-500">{hint}</span>
      ) : null}
      {error ? (
        <span role="alert" className="mt-1 block text-xs font-medium text-red-700">
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
    error: { box: "border-red-200 bg-red-50 text-red-800", icon: "alert" as const },
    success: { box: "border-brand-200 bg-brand-50 text-brand-900", icon: "check" as const },
    info: { box: "border-blue-200 bg-blue-50 text-blue-900", icon: "alert" as const },
  };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium ${tones[tone].box}`}
    >
      <Icon name={tones[tone].icon} size={16} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
