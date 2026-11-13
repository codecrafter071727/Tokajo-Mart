"use client";

import type { ReactNode } from "react";
import { Modal as BaseModal } from "./dialogs";
import { Alert, buttonClass, inputCls, dialogFooter } from "./kit";
import { AdminApiError } from "../lib/catalog-admin";

export const fieldClass = inputCls;
export const primaryButton = buttonClass("primary");
export const secondaryButton = buttonClass("secondary");
export const dangerButton = buttonClass("danger");

/** The shared dialog, with the catalog screens' vertical rhythm inside it. */
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
  return (
    <BaseModal title={title} onClose={onClose} wide={wide}>
      <div className="space-y-4">{children}</div>
    </BaseModal>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="mt-1 text-xs font-semibold text-bad">
      {message}
    </p>
  ) : null;
}

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof AdminApiError ? error.message : "Something went wrong. Try again.";
  return <Alert>{message}</Alert>;
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="fixed bottom-6 right-6 z-50 slide-in rounded-lg bg-ink px-4 py-3 text-sm font-medium text-canvas shadow-pop"
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
      <div className="text-sm text-ink-2">{body}</div>
      <ErrorBanner error={error} />
      <div className={dialogFooter}>
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
      className={`${size} shrink-0 rounded-lg border border-line bg-surface ${fit === "cover" ? "object-cover" : "object-contain"}`}
    />
  ) : (
    <span
      className={`${size} grid shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-xl`}
      style={color ? { backgroundColor: color } : undefined}
    >
      {emoji}
    </span>
  );
}
