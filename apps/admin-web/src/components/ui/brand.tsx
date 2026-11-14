import Image from "next/image";
import { cn } from "./core";

const RATIO = 1024 / 682;

/** Full Milcki lockup — matches tab icon and warehouse header. */
export function Logo({ height = 36, className }: { height?: number; className?: string }) {
  const width = Math.round(height * RATIO);
  return (
    <Image
      src="/logo.png"
      alt=""
      width={width}
      height={height}
      aria-hidden
      className={cn("h-auto w-auto shrink-0 object-contain", className)}
      style={{ height, width, maxHeight: height }}
    />
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
