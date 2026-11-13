"use client";

import type { ComponentProps } from "react";
import { buttonClass, type Size, type Variant } from "./button-style";
import { Loader2, type IconComponent } from "./icons";

/**
 * A button. Pass `pending` while its save runs: it shows a spinner and cannot be pressed twice.
 * (The hub reads this from the form; this console saves through fetch, so the caller says it.)
 */
export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  disabled,
  pending,
  icon: Icon,
  type = "button",
  ...p
}: ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  pending?: boolean;
  icon?: IconComponent;
}) {
  return (
    <button
      {...p}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClass(variant, size, className)}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : Icon ? (
        <Icon className="size-4" />
      ) : null}
      <span className={pending ? "opacity-80" : undefined}>{children}</span>
      {pending ? <span className="sr-only"> Saving</span> : null}
    </button>
  );
}
