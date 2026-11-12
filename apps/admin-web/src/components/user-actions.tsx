"use client";

import type { AdminUser } from "@qc/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { errorMessage, gw } from "../lib/gw";
import { ConfirmDialog } from "./dialogs";

/** Asks before blocking or unblocking someone, then does it and refreshes the lists. */
export function BlockDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const client = useQueryClient();
  const blocking = user.status !== "blocked";
  const run = useMutation({
    mutationFn: () =>
      gw("POST", `/v1/identity/admin/users/${user.id}/${blocking ? "block" : "unblock"}`),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["users"] });
      await client.invalidateQueries({ queryKey: ["live-riders"] });
      onDone(`${user.name} is ${blocking ? "blocked" : "active again"}.`);
    },
  });
  return (
    <ConfirmDialog
      title={blocking ? `Block ${user.name}?` : `Unblock ${user.name}?`}
      message={
        blocking
          ? "They are signed out at once and cannot sign in until you unblock them."
          : "They can sign in again."
      }
      confirmLabel={blocking ? "Block" : "Unblock"}
      danger={blocking}
      busy={run.isPending}
      error={run.isError ? errorMessage(run.error) : null}
      onConfirm={() => run.mutate()}
      onClose={onClose}
    />
  );
}
