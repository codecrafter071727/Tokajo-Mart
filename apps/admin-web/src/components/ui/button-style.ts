/** Button looks, shared by the server-side ButtonLink and the client-side Button (which shows a spinner while its form saves). */
export type Variant = "primary" | "secondary" | "ghost" | "danger";
export type Size = "sm" | "md";

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const BUTTON: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover shadow-card border border-transparent",
  secondary: "bg-surface text-ink-2 hover:bg-surface-2 border border-line-strong shadow-card",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 border border-transparent",
  danger: "bg-surface text-bad hover:bg-bad-soft border border-bad-line shadow-card",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
};

export const buttonClass = (variant: Variant, size: Size, extra?: string) =>
  cn(
    "inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45",
    BUTTON[variant],
    SIZE[size],
    extra,
  );
