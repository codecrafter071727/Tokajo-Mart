"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "./core";
import { X } from "./icons";

/**
 * A controlled dialog on the native <dialog>: mount it to open it, and it calls onClose when it is
 * dismissed (Escape, the close button or the backdrop). `side` makes it a drawer from the right.
 * Focus moves into it and back again on close, as the browser does for modal dialogs.
 */
export function Dialog({
  title,
  description,
  onClose,
  children,
  footer,
  wide,
  side,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      aria-labelledby={id}
      className={cn(
        "border-line bg-surface p-0 text-ink shadow-pop",
        side
          ? "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[560px] border-l"
          : cn("m-auto w-[calc(100%-2rem)] rounded-xl border", wide ? "max-w-2xl" : "max-w-lg"),
      )}
    >
      <div className={cn("flex flex-col", side ? "h-full" : "max-h-[88vh]")}>
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={id} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <div className="mt-0.5 text-[13px] text-muted">{description}</div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => ref.current?.close()}
            className="-mr-1 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
