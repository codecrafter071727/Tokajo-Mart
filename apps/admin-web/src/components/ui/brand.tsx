import { cn } from "./core";

/** Tokajo's mark: a solid accent tile with a shopping bag and a bolt (quick delivery). Flat, no gradient. */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[10px] bg-accent text-on-accent",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.56}
        height={size * 0.56}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 7h14l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7Z" />
        <path d="M9 7V5a3 3 0 0 1 6 0v2" />
        <path d="m12.5 11-2 3.5h3l-2 3.5" />
      </svg>
    </span>
  );
}

const initialsOf = (s: string) =>
  s
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** A person's initials on a quiet neutral tile with a hairline ring. Flat, no gradient. */
export function Avatar({
  name,
  size = 36,
  title,
  className,
}: {
  name: string;
  size?: number;
  title?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-ink-2 ring-1 ring-line",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
      title={title ?? name}
    >
      {initialsOf(name)}
    </span>
  );
}
