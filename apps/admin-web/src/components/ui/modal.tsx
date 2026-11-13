"use client";

import { X } from "./icons";
import { useRef, type ReactNode } from "react";
import { cn } from "./core";

/**
 * A dialog opened by a button, built on the native <dialog>: focus is trapped, Escape closes it, and the form inside is a plain
 * server-action form. `trigger` is the button's content; `triggerClass` lets a caller style it like any other button.
 */
export function Modal({
  trigger,
  triggerClass,
  title,
  description,
  wide,
  children,
}: {
  trigger: ReactNode;
  triggerClass: string;
  title: string;
  description?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={triggerClass} onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className={cn(
          "m-auto w-[calc(100%-2rem)] rounded-xl border border-line bg-surface p-0 shadow-pop open:flex open:flex-col",
          wide ? "max-w-3xl" : "max-w-lg",
          "max-h-[90vh]",
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
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
        <div className="overflow-y-auto p-5">{children}</div>
      </dialog>
    </>
  );
}
