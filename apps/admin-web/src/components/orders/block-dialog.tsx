"use client";

import type { AdminUser } from "@qc/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { errorMessage, gw } from "../../lib/gw";
import { Button, Callout } from "../ui/core";
import { Dialog } from "../ui/dialog";

/** Asks before blocking or unblocking a customer, then refreshes every list they appear in. */
export function BlockCustomerDialog({
  user,
  onClose,
  onDone,
}: {
  user: Pick<AdminUser, "id" | "name" | "status">;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const client = useQueryClient();
  const blocking = user.status !== "blocked";
  const name = user.name || "this customer";
  const run = useMutation({
    mutationFn: () =>
      gw("POST", `/v1/identity/admin/users/${user.id}/${blocking ? "block" : "unblock"}`),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["users"] }),
        client.invalidateQueries({ queryKey: ["admin-user", user.id] }),
      ]);
      onDone(blocking ? `${name} is blocked and signed out.` : `${name} can sign in again.`);
    },
  });
  return (
    <Dialog
      title={blocking ? `Block ${name}?` : `Unblock ${name}?`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant={blocking ? "danger" : "primary"}
            pending={run.isPending}
            onClick={() => run.mutate()}
          >
            {blocking ? "Block" : "Unblock"}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-6 text-ink-2">
        {blocking
          ? "They are signed out at once and cannot sign in or order until you unblock them. Orders already placed carry on."
          : "They can sign in and order again."}
      </p>
      {run.isError ? (
        <div className="mt-4">
          <Callout tone="bad">{errorMessage(run.error)}</Callout>
        </div>
      ) : null}
    </Dialog>
  );
}
