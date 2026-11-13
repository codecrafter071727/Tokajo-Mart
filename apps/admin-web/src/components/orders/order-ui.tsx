"use client";

import type { AdminOrder, PaymentStatus } from "@qc/contracts";
import { useState } from "react";
import { rupees } from "../../lib/api";
import { useCancelOrder, useRefund } from "../../lib/admin-orders";
import { errorMessage } from "../../lib/gw";
import { rupeesToPaise } from "../../lib/format";
import { Badge, Button, Callout, type Tone } from "../ui/core";
import { Dialog } from "../ui/dialog";
import { Field, Input, Textarea } from "../ui/form";

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  created: { label: "Awaiting payment", tone: "neutral" },
  captured: { label: "Paid", tone: "ok" },
  failed: { label: "Failed", tone: "bad" },
  refunded: { label: "Refunded", tone: "info" },
  partially_refunded: { label: "Part refunded", tone: "info" },
};

/** Cash, or online with where the money stands. */
export function PaymentBadge({
  method,
  status,
  orderStatus,
}: {
  method: AdminOrder["paymentMethod"];
  status: PaymentStatus | null;
  /** An order that ended before it was paid reads "Not paid", not "Awaiting payment" */
  orderStatus?: AdminOrder["status"];
}) {
  if (method === "cod") {
    return (
      <Badge tone="neutral" dot={false}>
        Cash on delivery
      </Badge>
    );
  }
  const ended = orderStatus === "cancelled" || orderStatus === "expired";
  if ((status === null || status === "created") && ended) {
    return (
      <Badge tone="neutral" dot={false}>
        Online · Not paid
      </Badge>
    );
  }
  const s = status ? PAYMENT_STATUS[status] : null;
  return <Badge tone={s?.tone ?? "neutral"}>{s ? `Online · ${s.label}` : "Online"}</Badge>;
}

const REASONS = [
  "Customer asked to cancel",
  "Items out of stock",
  "Address not serviceable",
  "Duplicate order",
  "Suspected fraud",
];

export function CancelOrderDialog({
  order,
  onClose,
  onDone,
}: {
  order: Pick<AdminOrder, "id" | "number" | "paymentMethod" | "totalPaise"> & {
    paymentStatus: PaymentStatus | null;
  };
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const cancel = useCancelOrder(order.id);
  const paid =
    order.paymentMethod === "online" &&
    (order.paymentStatus === "captured" || order.paymentStatus === "partially_refunded");
  const tooShort = reason.trim().length < 3;
  return (
    <Dialog
      title={`Cancel order ${order.number}?`}
      description="The customer sees it as cancelled at once and the stock goes back on the shelf."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Keep the order</Button>
          <Button
            variant="danger"
            pending={cancel.isPending}
            disabled={tooShort}
            onClick={() =>
              cancel.mutate(reason.trim(), {
                onSuccess: () =>
                  onDone(
                    paid
                      ? `Order ${order.number} is cancelled and its payment is being refunded.`
                      : `Order ${order.number} is cancelled.`,
                  ),
              })
            }
          >
            Cancel order
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {paid ? (
          <Callout tone="info" title="The customer paid online">
            Cancelling refunds what is left of their payment in full, back to how they paid.
          </Callout>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                reason === r
                  ? "border-accent-line bg-accent-soft text-accent"
                  : "border-line bg-surface text-ink-2 hover:bg-surface-2"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <Field label="Reason" required hint="Saved on the order's history.">
          <Textarea
            rows={3}
            value={reason}
            maxLength={200}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this order being cancelled?"
          />
        </Field>
        {cancel.isError ? <Callout tone="bad">{errorMessage(cancel.error)}</Callout> : null}
      </div>
    </Dialog>
  );
}

export function RefundDialog({
  orderId,
  orderNumber,
  refundablePaise,
  onClose,
  onDone,
}: {
  orderId: string;
  orderNumber: string;
  refundablePaise: number;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  // One key for this dialog: a double click or a retry after a timeout cannot refund twice
  const [key] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState(String(refundablePaise / 100));
  const [reason, setReason] = useState("");
  const refund = useRefund(orderId, key);
  const paise = rupeesToPaise(amount);
  const amountError =
    amount.trim() === ""
      ? "Enter an amount."
      : paise === null || paise <= 0
        ? "Enter an amount like 120 or 45.50."
        : paise > refundablePaise
          ? `At most ${rupees(refundablePaise)} can be refunded.`
          : undefined;
  const reasonError =
    reason.trim().length > 0 && reason.trim().length < 3 ? "Say a little more." : undefined;
  const ready = !amountError && reason.trim().length >= 3;
  const full = paise === refundablePaise;

  return (
    <Dialog
      title={`Refund order ${orderNumber}`}
      description={`Up to ${rupees(refundablePaise)} can still be refunded. Razorpay returns it to how the customer paid, usually in 5 to 7 working days.`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            pending={refund.isPending}
            disabled={!ready}
            onClick={() =>
              refund.mutate(
                { amountPaise: paise ?? undefined, reason: reason.trim() },
                {
                  onSuccess: () =>
                    onDone(`Refund of ${rupees(paise ?? 0)} started for ${orderNumber}.`),
                },
              )
            }
          >
            {paise && !amountError ? `Refund ${rupees(paise)}` : "Refund"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Amount (₹)" required error={amountError}>
          <div className="flex gap-2">
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-9 tnum"
              aria-invalid={Boolean(amountError)}
            />
            <Button
              size="md"
              variant={full ? "secondary" : "ghost"}
              onClick={() => setAmount(String(refundablePaise / 100))}
            >
              Full
            </Button>
          </div>
        </Field>
        <Field
          label="Reason"
          required
          error={reasonError}
          hint="Kept with the refund for the records."
        >
          <Textarea
            rows={2}
            value={reason}
            maxLength={200}
            onChange={(event) => setReason(event.target.value)}
            placeholder="For example: one item was missing"
          />
        </Field>
        {refund.isError ? <Callout tone="bad">{errorMessage(refund.error)}</Callout> : null}
      </div>
    </Dialog>
  );
}
