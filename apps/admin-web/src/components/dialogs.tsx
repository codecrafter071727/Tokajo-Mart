"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Alert, Button } from "./ui";

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
          ? "fixed inset-y-0 right-0 left-auto m-0 h-screen max-h-none w-full max-w-xl rounded-none p-0 shadow-xl backdrop:bg-black/40"
          : `m-auto w-full rounded-2xl p-0 shadow-xl backdrop:bg-black/40 ${wide ? "max-w-2xl" : "max-w-lg"}`
      }
    >
      <div className="max-h-[90vh] overflow-y-auto p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={id} className="text-lg font-extrabold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => ref.current?.close()}
            className="rounded-lg px-2 py-1 text-ink-500 hover:bg-surface"
          >
            ✕
          </button>
        </div>
        {children}
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
      <p className="text-sm text-ink-700">{message}</p>
      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>
          {busy ? "Working" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
