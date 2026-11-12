"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AdminApiError } from "../lib/catalog-admin";

export const fieldClass = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm";
export const primaryButton =
  "rounded-lg bg-brand-600 px-5 py-2 text-sm font-extrabold text-ink-900 disabled:opacity-50";
export const secondaryButton =
  "rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-surface disabled:opacity-50";
export const dangerButton =
  "rounded-lg bg-red-600 px-5 py-2 text-sm font-extrabold text-white disabled:opacity-50";

/** A modal built on the native dialog element: focus trap, Escape and backdrop come for free. */
export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="modal-title"
      className={`m-auto w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl p-0 shadow-xl backdrop:bg-black/40`}
    >
      <div className="space-y-4 p-6">
        <h2 id="modal-title" className="text-lg font-extrabold">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="mt-1 text-xs font-semibold text-red-700">
      {message}
    </p>
  ) : null;
}

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof AdminApiError ? error.message : "Something went wrong. Try again.";
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
      {message}
    </p>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="fixed bottom-6 right-6 z-50 rounded-lg bg-ink-900 px-4 py-3 text-sm font-semibold text-white shadow-lg"
    >
      {message}
    </p>
  );
}

/** Asks before doing something that is awkward to undo. */
export function ConfirmModal({
  title,
  body,
  confirmLabel,
  pending,
  error,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  pending: boolean;
  error: unknown;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="text-sm text-ink-700">{body}</div>
      <ErrorBanner error={error} />
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className={secondaryButton}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={danger ? dangerButton : primaryButton}
        >
          {pending ? "Working" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/** A small picture with a fallback, for image links and emoji. */
export function Thumb({
  imageUrl,
  emoji,
  fit = "contain",
  size = "size-10",
  color,
}: {
  imageUrl: string | null;
  emoji?: string;
  fit?: "cover" | "contain";
  size?: string;
  color?: string;
}) {
  return imageUrl ? (
    <img
      src={imageUrl}
      alt=""
      className={`${size} shrink-0 rounded-lg border border-line bg-white ${fit === "cover" ? "object-cover" : "object-contain"}`}
    />
  ) : (
    <span
      className={`${size} grid shrink-0 place-items-center rounded-lg border border-line bg-surface text-xl`}
      style={color ? { backgroundColor: color } : undefined}
    >
      {emoji}
    </span>
  );
}
