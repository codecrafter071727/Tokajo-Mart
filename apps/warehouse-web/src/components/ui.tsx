"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode, type SVGProps } from "react";

// ---------------------------------------------------------------------------------------------
// Icons: a small inline set so the app needs no icon dependency
// ---------------------------------------------------------------------------------------------

const PATHS = {
  back: "M15 18l-6-6 6-6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  clock: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8",
  bike: "M5 17a3 3 0 100-6 3 3 0 000 6zm14 0a3 3 0 100-6 3 3 0 000 6zM8 14l3-6h4l3 6M11 8L9 5H6",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-3.5-3.5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  alert:
    "M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  refresh: "M20 11a8 8 0 10-2.3 5.7M20 4v7h-7",
  logout: "M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 01-2-2V5a2 2 0 012-2h7",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  handover: "M7 11l3 3 7-7M4 21h16M4 17h16",
  shelf: "M3 5h18M3 12h18M3 19h18M6 5v14M18 5v14",
  close: "M6 6l12 12M18 6L6 18",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z",
  eyeOff:
    "M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2",
  pin: "M12 21s-7-6.3-7-11a7 7 0 1114 0c0 4.7-7 11-7 11zm0-8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  sound: "M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13",
  mute: "M11 5L6 9H3v6h3l5 4V5zM16 9l5 6M21 9l-5 6",
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------------------------

const VARIANT = {
  primary:
    "bg-brand-600 text-ink-900 hover:bg-brand-500 active:bg-brand-700 active:text-white disabled:bg-brand-200 disabled:text-brand-900/60",
  secondary:
    "border border-line bg-white text-ink-900 hover:bg-surface active:bg-line disabled:text-ink-500",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-200",
  ghost: "text-ink-700 hover:bg-surface active:bg-line",
} as const;
const SIZE = {
  sm: "h-9 gap-1.5 px-3 text-sm",
  md: "h-11 gap-2 px-4 text-base",
  lg: "h-14 gap-2 px-6 text-lg",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
}) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-lg font-bold transition disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------------------------

export type Tone = "green" | "amber" | "red" | "gray" | "blue";

const TONES: Record<Tone, { badge: string; dot: string }> = {
  green: { badge: "bg-brand-100 text-brand-900", dot: "bg-brand-600" },
  amber: { badge: "bg-amber-100 text-amber-900", dot: "bg-amber-500" },
  red: { badge: "bg-red-100 text-red-800", dot: "bg-red-600" },
  gray: { badge: "bg-surface text-ink-700", dot: "bg-ink-500" },
  blue: { badge: "bg-blue-100 text-blue-900", dot: "bg-blue-600" },
};

export function Badge({
  tone,
  dot = false,
  size = "sm",
  children,
}: {
  tone: Tone;
  dot?: boolean;
  size?: "sm" | "md";
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-bold ${
        size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"
      } ${TONES[tone].badge}`}
    >
      {dot ? <span className={`size-2 rounded-full ${TONES[tone].dot}`} /> : null}
      {children}
    </span>
  );
}

export const toneDot = (tone: Tone) => TONES[tone].dot;

// ---------------------------------------------------------------------------------------------
// Page furniture
// ---------------------------------------------------------------------------------------------

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[30px] font-extrabold leading-9 tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-base text-ink-700">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-line bg-white shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function ErrorBanner({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base font-semibold text-red-800"
    >
      <Icon name="alert" className="shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export function Empty({
  icon = "box",
  title,
  children,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-line bg-white/60 px-6 py-10 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-surface text-ink-500">
        <Icon name={icon} size={24} />
      </span>
      <p className="text-base font-bold text-ink-700">{title}</p>
      {children ? <p className="mt-1 text-sm text-ink-500">{children}</p> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-line/70 ${className}`} aria-hidden="true" />;
}

/** Product picture, or its emoji when there is no photo. */
export function Thumb({
  imageUrl,
  emoji,
  size = 56,
  className = "",
}: {
  imageUrl: string | null | undefined;
  emoji: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {imageUrl ? (
        // A plain img: product photos come from many hosts, so next/image would need each listed
        <img src={imageUrl} alt="" className="size-full object-contain p-1" />
      ) : (
        <span aria-hidden="true">{emoji}</span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Dialog: the native element, so focus trapping, Escape and the backdrop come for free
// ---------------------------------------------------------------------------------------------

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`m-auto w-[calc(100%-2rem)] rounded-xl bg-white p-0 text-ink-900 shadow-dialog ${
        wide ? "max-w-2xl" : "max-w-md"
      }`}
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
            <h2 className="text-xl font-extrabold">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </Button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-3 border-t border-line px-6 py-4">{footer}</div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

export const inputClass =
  "h-11 w-full rounded-lg border border-line bg-white px-3 text-base text-ink-900 outline-none transition placeholder:text-ink-500 focus:border-brand-600 focus:ring-2 focus:ring-brand-200";

export const th =
  "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-500 whitespace-nowrap";
export const td = "px-4 py-3 text-base";
