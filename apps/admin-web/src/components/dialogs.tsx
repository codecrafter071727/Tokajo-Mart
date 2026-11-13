"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./icons";
import { Alert, Button, dialogFooter } from "./ui";

/**
 * A modal dialog. Mount it to open it, and it calls onClose when dismissed (Escape, the close
 * button or the backdrop), so the parent just unmounts it.
 */
export function Modal({
  title,
  onClose,
  children,
  wide,
  side,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /** Slides in from the right as a drawer instead of a centred dialog */
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  const id = useId();
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      aria-labelledby={id}
      className={
        side
          ? "fixed inset-y-0 right-0 left-auto m-0 h-screen max-h-none w-full max-w-xl rounded-none border-l border-line bg-white p-0 shadow-dialog"
          : `m-auto w-[calc(100%-2rem)] rounded-xl border border-line bg-white p-0 shadow-dialog ${wide ? "max-w-2xl" : "max-w-lg"}`
      }
    >
      <div className={side ? "flex h-full flex-col" : "flex max-h-[88vh] flex-col"}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <h2 id={id} className="text-base font-semibold text-ink-900">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => ref.current?.close()}
            className="grid size-8 place-items-center rounded-lg text-ink-500 hover:bg-surface hover:text-ink-900"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </dialog>
  );
}

/** A yes or no question before something that is hard to undo. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm leading-6 text-ink-700">{message}</p>
      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      <div className={dialogFooter}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>
          {busy ? "Working" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
