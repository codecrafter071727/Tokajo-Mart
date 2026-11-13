import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { Avatar as HubAvatar } from "./ui/brand";
import { buttonClass as hubButtonClass } from "./ui/button-style";
import { cn } from "./ui/core";
import { ChevronRight, Loader2 } from "./ui/icons";

/*
 * The console's page building blocks, drawn with the Booking Hub design tokens (see globals.css and
 * the kit under components/ui). Screens built before the port import these; new screens can use
 * components/ui directly. Both look the same.
 */

// ---------------------------------------------------------------------------------------------
// Page frame
// ---------------------------------------------------------------------------------------------

/** Id of the header slot that PageActions renders into */
export const ACTIONS_SLOT = "page-actions";

export type Crumb = { label: string; href?: string };

/** Breadcrumbs, the title, a one-line description and, on the right, the page's main actions. */
export function PageHeader({
  title,
  subtitle,
  description,
  action,
  actions,
  crumbs,
  badge,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  actions?: ReactNode;
  crumbs?: Crumb[];
  badge?: ReactNode;
}) {
  const text = description ?? subtitle;
  return (
    <div className="rise mb-6">
      {crumbs && crumbs.length > 0 ? (
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex flex-wrap items-center gap-1 text-[13px] text-muted"
        >
          {crumbs.map((c, i) => (
            <span key={`${c.label}${i}`} className="flex items-center gap-1">
              {i > 0 ? <ChevronRight className="size-3.5 text-faint" /> : null}
              {c.href ? (
                <a href={c.href} className="hover:text-ink">
                  {c.label}
                </a>
              ) : (
                <span className="text-ink-2">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl leading-8 font-semibold tracking-tight text-ink">{title}</h1>
            {badge}
          </div>
          {text ? <div className="mt-0.5 max-w-3xl text-sm text-muted">{text}</div> : null}
        </div>
        <div id={ACTIONS_SLOT} className="flex shrink-0 flex-wrap items-center gap-2">
          {action}
          {actions}
        </div>
      </div>
    </div>
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
      className={cn(
        "min-w-0 rounded-xl border border-line bg-surface shadow-card",
        padded && "p-5",
        className,
      )}
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

/** Older names (green, amber...) and the hub's names (ok, warn...) both work. */
export type Tone =
  | "green"
  | "amber"
  | "red"
  | "gray"
  | "blue"
  | "ok"
  | "warn"
  | "bad"
  | "neutral"
  | "info"
  | "accent";

const TONE: Record<Tone, string> = {
  green: "bg-ok-soft text-ok border-ok-line",
  ok: "bg-ok-soft text-ok border-ok-line",
  amber: "bg-warn-soft text-warn border-warn-line",
  warn: "bg-warn-soft text-warn border-warn-line",
  red: "bg-bad-soft text-bad border-bad-line",
  bad: "bg-bad-soft text-bad border-bad-line",
  gray: "bg-surface-2 text-ink-2 border-line",
  neutral: "bg-surface-2 text-ink-2 border-line",
  blue: "bg-info-soft text-info border-info-line",
  info: "bg-info-soft text-info border-info-line",
  accent: "bg-accent-soft text-accent border-accent-line",
};
const DOT: Record<Tone, string> = {
  green: "bg-ok",
  ok: "bg-ok",
  amber: "bg-warn",
  warn: "bg-warn",
  red: "bg-bad",
  bad: "bg-bad",
  gray: "bg-faint",
  neutral: "bg-faint",
  blue: "bg-info",
  info: "bg-info",
  accent: "bg-accent",
};

/** Status label. Tones mean the same everywhere: info new, warn in progress, ok done, bad problem, neutral inactive. */
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
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs leading-5 font-medium whitespace-nowrap",
        TONE[tone],
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", DOT[tone])} aria-hidden /> : null}
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
    <div className="data-table rise max-h-[calc(100vh-13rem)] overflow-auto rounded-xl border border-line bg-surface shadow-card">
      {children}
    </div>
  );
}

export const th = "whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted";
export const td = "px-4 py-2.5 text-[13px] text-ink align-middle";
/** Numbers line up on the right and use fixed width digits */
export const thNum = `${th} text-right`;
export const tdNum = `${td} text-right tnum`;
/** The actions column sits on the right */
export const tdActions = `${td} text-right whitespace-nowrap`;

/** Initials on a quiet tile, as in the hub. */
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return <HubAvatar name={name.trim() || "?"} size={size} />;
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
        <div className="flex items-center gap-2 font-medium text-ink">
          <span className="truncate">{name}</span>
          {badge}
        </div>
        {detail ? <div className="truncate text-xs text-muted">{detail}</div> : null}
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center">
        <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Icon name="inbox" />
        </span>
        <span className="text-[13px] text-muted">{children}</span>
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
                className="h-3.5 animate-pulse rounded-md bg-line/70"
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
    <div className="rise flex flex-col items-center rounded-xl border border-line bg-surface px-6 py-12 text-center shadow-card">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-2 text-muted">
        <Icon name={icon} />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children ? <p className="mt-1 max-w-md text-[13px] text-muted">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------------------------

const CONTROL =
  "rounded-lg border border-line-strong bg-surface text-sm text-ink shadow-card placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-surface-2 disabled:text-muted";

/** Text inputs inside a Field (with the gap under the label) */
export const inputCls = `mt-1 block h-9 w-full px-3 ${CONTROL}`;
/** Free standing controls in a toolbar */
export const controlCls = `h-9 px-3 ${CONTROL}`;
export const selectCls = `h-9 pl-3 pr-8 ${CONTROL}`;

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
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
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
    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-[13px] text-ink-2 select-none hover:bg-surface-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-line-strong accent-[var(--color-accent)]"
      />
      {label}
    </label>
  );
}

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "subtle" | "dangerGhost";
export type ButtonSize = "sm" | "md";

/** Class string for things that look like buttons but are links or plain elements. */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md") {
  if (variant === "subtle") return hubButtonClass("ghost", size);
  if (variant === "dangerGhost")
    return hubButtonClass("ghost", size, "text-bad hover:bg-bad-soft hover:text-bad");
  if (variant === "ghost") return hubButtonClass("ghost", size, "text-accent hover:text-accent");
  return hubButtonClass(variant, size);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  small?: boolean;
  icon?: IconName;
  /** Shows a spinner and blocks a second press while a save runs */
  pending?: boolean;
};

export function Button({
  variant = "secondary",
  small,
  icon,
  pending,
  className = "",
  type = "button",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`${
        // Small ghost buttons are row actions: quiet text, like rowAction
        small && variant === "ghost"
          ? rowAction
          : small && variant === "dangerGhost"
            ? rowActionDanger
            : buttonClass(variant, small ? "sm" : "md")
      } ${className}`}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : icon ? (
        <Icon name={icon} size={small ? 14 : 16} />
      ) : null}
      {children}
    </button>
  );
}

/** The button row at the bottom of a dialog: stays in view while a long form scrolls. */
export const dialogFooter =
  "sticky -bottom-5 -mx-5 -mb-5 mt-6 flex justify-end gap-2 border-t border-line bg-surface px-5 py-4";

/** Row level actions: quiet text buttons, red for the destructive one. */
export const rowAction =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";
export const rowActionDanger =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-bad transition-colors hover:bg-bad-soft disabled:cursor-not-allowed disabled:opacity-40";

/** A filter chip: accent when selected, as the hub's filter menus. */
export function chipClass(active: boolean) {
  return `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors ${
    active
      ? "border-accent-line bg-accent-soft text-accent"
      : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
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
      className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-[13px]"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            value === o.value
              ? "bg-surface text-ink shadow-card ring-1 ring-line"
              : "text-muted hover:text-ink"
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
  description,
  actions,
  children,
  flush,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** No padding around the body, for tables that run edge to edge */
  flush?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rise min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-card",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description ? <div className="mt-0.5 text-[13px] text-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
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
    <label className="block text-[13px] font-medium text-ink-2">
      {label}
      {children}
      {hint && !error ? (
        <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>
      ) : null}
      {error ? (
        <span role="alert" className="mt-1 block text-xs font-normal text-bad">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Alert({
  tone = "error",
  title,
  children,
}: {
  tone?: "error" | "success" | "info" | "warning";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    error: { box: "border-bad-line bg-bad-soft text-bad", icon: "alert" as const },
    success: { box: "border-ok-line bg-ok-soft text-ok", icon: "check" as const },
    info: { box: "border-info-line bg-info-soft text-info", icon: "alert" as const },
    warning: { box: "border-warn-line bg-warn-soft text-warn", icon: "alert" as const },
  };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-[13px] ${tones[tone].box}`}
    >
      <Icon name={tones[tone].icon} size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title ? <div className="font-semibold">{title}</div> : null}
        <div className={title ? "mt-0.5 text-ink-2" : "font-medium"}>{children}</div>
      </div>
    </div>
  );
}
