"use client";

import type {
  AdminOrderDetail,
  AdminPaymentDetail,
  OrderHistoryEntry,
  OrderStatus,
} from "@qc/contracts";
import Link from "next/link";
import { useState } from "react";
import {
  CancelOrderDialog,
  PAYMENT_STATUS,
  PaymentBadge,
  RefundDialog,
} from "../../../components/orders/order-ui";
import { useWarehouse } from "../../../components/shell/warehouse-context";
import { Avatar } from "../../../components/ui/brand";
import { Badge, Button, Callout, Card, EmptyState, Mono, cn } from "../../../components/ui/core";
import {
  ArrowUpRight,
  Ban,
  Bike,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  MapPin,
  Package,
  Phone,
  Receipt,
  RotateCcw,
  Star,
  Users,
  XCircle,
} from "../../../components/ui/icons";
import { PageHeader } from "../../../components/ui/layout";
import { DetailPageSkeleton } from "../../../components/ui/skeleton";
import {
  isActive,
  isCancellable,
  useAdminOrder,
  useOrderHistory,
  usePaymentDetail,
} from "../../../lib/admin-orders";
import { rupees } from "../../../lib/api";
import { dateTime, minutesBetween, timeAgo, timeOnly } from "../../../lib/format";
import { GwError, errorMessage } from "../../../lib/gw";
import { ORDER_STATUS } from "../../../lib/order-status";
import { DeliveryExtras } from "./delivery-extras";

const FLOW: { status: OrderStatus; label: string }[] = [
  { status: "confirmed", label: "Placed" },
  { status: "packing", label: "Packing" },
  { status: "packed", label: "Packed" },
  { status: "picked_up", label: "Picked up" },
  { status: "out_for_delivery", label: "On the way" },
  { status: "delivered", label: "Delivered" },
];

const ACTOR: Record<string, string> = {
  customer: "Customer",
  warehouse_staff: "Packer",
  warehouse_manager: "Warehouse manager",
  rider: "Rider",
  admin: "Admin",
  system: "Automatic",
};

export function OrderDetail({ id }: { id: string }) {
  const order = useAdminOrder(id);
  const history = useOrderHistory(id, order.isSuccess);
  const online = order.data?.paymentMethod === "online";
  const payment = usePaymentDetail(id, Boolean(online));
  const { nameOf } = useWarehouse();
  const [dialog, setDialog] = useState<"cancel" | "refund" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (order.isPending) return <DetailPageSkeleton label="Loading the order" />;
  if (order.isError) {
    const missing = order.error instanceof GwError && order.error.status === 404;
    return (
      <>
        <PageHeader
          title="Order"
          crumbs={[{ label: "Live orders", href: "/orders" }, { label: "Order" }]}
        />
        <Card>
          <EmptyState
            icon={<Package className="size-5" />}
            title={missing ? "Order not found" : "Could not load the order"}
          >
            {missing
              ? "It may have been removed, or the link is wrong."
              : errorMessage(order.error)}
          </EmptyState>
        </Card>
      </>
    );
  }

  const o = order.data;
  const s = ORDER_STATUS[o.status];
  const age = minutesBetween(o.placedAt, o.deliveredAt ?? o.cancelledAt);
  const late = isActive(o.status) && age > o.promisedMins;
  const pay = payment.data ?? null;
  const refundable = pay?.refundablePaise ?? 0;
  const itemCount = o.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Live orders", href: "/orders" }, { label: o.number }]}
        title={<span className="tnum">Order {o.number}</span>}
        badge={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={s.tone}>{s.label}</Badge>
            {late ? <Badge tone="bad">Late by {age - o.promisedMins} min</Badge> : null}
            <PaymentBadge
              method={o.paymentMethod}
              status={o.paymentStatus}
              orderStatus={o.status}
            />
          </span>
        }
        description={`Placed ${dateTime(o.placedAt)} (${timeAgo(o.placedAt)}) · ${nameOf(o.warehouseId)} · ${itemCount} ${itemCount === 1 ? "item" : "items"} · ${rupees(o.totalPaise)}`}
        actions={
          <>
            {refundable > 0 ? (
              <Button icon={RotateCcw} onClick={() => setDialog("refund")}>
                Refund
              </Button>
            ) : null}
            {isCancellable(o.status) ? (
              <Button variant="danger" icon={Ban} onClick={() => setDialog("cancel")}>
                Cancel order
              </Button>
            ) : null}
          </>
        }
      />

      {notice ? <Callout tone="ok">{notice}</Callout> : null}
      {o.status === "cancelled" && o.cancelReason ? (
        <Callout tone="bad" title={`Cancelled ${o.cancelledAt ? dateTime(o.cancelledAt) : ""}`}>
          {o.cancelReason}
        </Callout>
      ) : null}

      <Progress order={o} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card
            className="rise"
            title="Items"
            description={
              o.status === "packing"
                ? `${o.items.filter((i) => i.picked).length} of ${o.items.length} picked`
                : `${itemCount} ${itemCount === 1 ? "item" : "items"}`
            }
            flush
          >
            <ul className="divide-y divide-line">
              {o.items.map((item) => (
                <li key={item.productId} className="flex items-center gap-4 px-5 py-3">
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2 text-xl ring-1 ring-line">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="size-full object-contain p-1" />
                    ) : (
                      <span aria-hidden>{item.emoji || "📦"}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{item.name}</div>
                    <div className="text-xs text-muted">
                      {item.unit} · <span className="tnum">{rupees(item.unitPricePaise)}</span>
                      {item.mrpPaise > item.unitPricePaise ? (
                        <span className="ml-1 text-faint line-through tnum">
                          {rupees(item.mrpPaise)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {["packing", "packed", "picked_up", "out_for_delivery", "delivered"].includes(
                    o.status,
                  ) ? (
                    <span
                      className={cn(
                        "hidden items-center gap-1 text-xs font-medium sm:flex",
                        item.picked ? "text-ok" : "text-muted",
                      )}
                    >
                      {item.picked ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <Clock className="size-4" />
                      )}
                      {item.picked ? "Picked" : "Not picked"}
                    </span>
                  ) : null}
                  <span className="w-10 text-right text-sm text-muted tnum">×{item.quantity}</span>
                  <span className="w-20 text-right text-sm font-semibold text-ink tnum">
                    {rupees(item.unitPricePaise * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <Totals order={o} refundedPaise={pay?.refundedPaise ?? 0} />
          </Card>

          <Card
            className="rise"
            title="Timeline"
            description="Every step, when it happened and who did it"
          >
            {history.isPending ? (
              <p className="text-[13px] text-muted">Loading the history</p>
            ) : history.isError ? (
              <Callout tone="bad">{errorMessage(history.error)}</Callout>
            ) : (
              <Timeline entries={history.data.items} />
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="rise" title="Customer" actions={<Users className="size-4 text-muted" />}>
            <div className="flex items-center gap-3">
              <Avatar name={o.customerName || "Customer"} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">
                  {o.customerName || "Customer"}
                </div>
                {o.customerPhone ? (
                  <a
                    href={`tel:${o.customerPhone}`}
                    className="flex items-center gap-1 text-[13px] text-muted hover:text-accent tnum"
                  >
                    <Phone className="size-3.5" />
                    {o.customerPhone}
                  </a>
                ) : null}
              </div>
            </div>
            <Link
              href={`/customers/${o.userId}`}
              className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-line-strong px-3 py-2 text-[13px] font-medium text-ink-2 shadow-card hover:bg-surface-2"
            >
              View customer and their orders <ArrowUpRight className="size-3.5" />
            </Link>
          </Card>

          <Card
            className="rise"
            title="Delivery address"
            actions={<MapPin className="size-4 text-muted" />}
          >
            <div className="space-y-1 text-[13px]">
              <Badge tone="neutral" dot={false}>
                {o.address.tag}
              </Badge>
              <p className="pt-1 text-ink">{o.address.line1}</p>
              {o.address.line2 ? <p className="text-ink-2">{o.address.line2}</p> : null}
              {o.instructions ? (
                <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-warn ring-1 ring-warn-line">
                  “{o.instructions}”
                </p>
              ) : null}
              {o.addressLat !== null && o.addressLng !== null ? (
                <a
                  href={`https://www.google.com/maps?q=${o.addressLat},${o.addressLng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 font-medium text-accent hover:underline"
                >
                  Open in Maps <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </div>
          </Card>

          <Card className="rise" title="Rider" actions={<Bike className="size-4 text-muted" />}>
            {o.rider ? (
              <div className="flex items-center gap-3">
                <Avatar name={o.rider.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{o.rider.name}</div>
                  <div className="flex items-center gap-3 text-[13px] text-muted">
                    {o.rider.phone ? (
                      <a
                        href={`tel:${o.rider.phone}`}
                        className="flex items-center gap-1 hover:text-accent tnum"
                      >
                        <Phone className="size-3.5" />
                        {o.rider.phone}
                      </a>
                    ) : null}
                    <span className="flex items-center gap-0.5 tnum">
                      <Star className="size-3.5 text-warn" /> {o.rider.rating.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-muted">
                {isActive(o.status)
                  ? o.status === "packed"
                    ? "Packed and waiting for a rider to accept."
                    : "A rider is assigned once the order is packed."
                  : "No rider was assigned."}
              </p>
            )}
            {o.rider ? <DeliveryExtras orderId={o.id} live={isActive(o.status)} /> : null}
          </Card>

          <PaymentCard
            order={o}
            loading={payment.isPending && online}
            error={payment.isError ? errorMessage(payment.error) : null}
            payment={pay}
            onRefund={() => setDialog("refund")}
          />
        </div>
      </div>

      {dialog === "cancel" ? (
        <CancelOrderDialog
          order={o}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            setNotice(message);
          }}
        />
      ) : null}
      {dialog === "refund" && pay ? (
        <RefundDialog
          orderId={o.id}
          orderNumber={o.number}
          refundablePaise={refundable}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            setNotice(message);
          }}
        />
      ) : null}
    </div>
  );
}

/** Where the order is on its way to the door. */
function Progress({ order }: { order: AdminOrderDetail }) {
  const stamps: Partial<Record<OrderStatus, string | null>> = {
    confirmed: order.confirmedAt ?? order.placedAt,
    packed: order.packedAt,
    picked_up: order.pickedUpAt,
    out_for_delivery: order.outForDeliveryAt,
    delivered: order.deliveredAt,
  };
  const stopped = ["cancelled", "expired", "payment_failed", "pending_payment"].includes(
    order.status,
  );
  const reached = FLOW.findIndex((f) => f.status === order.status);
  if (stopped && order.status !== "pending_payment") return null;
  return (
    <Card className="rise" flush>
      <ol className="grid grid-cols-3 gap-y-4 px-5 py-4 sm:grid-cols-6">
        {FLOW.map((step, i) => {
          const done = !stopped && i <= reached;
          const current = !stopped && i === reached;
          const at = stamps[step.status];
          return (
            <li key={step.status} className="relative flex flex-col items-center text-center">
              {i > 0 ? (
                <span
                  className={cn(
                    "absolute top-3.5 right-1/2 hidden h-0.5 w-full -translate-y-1/2 sm:block",
                    done ? "bg-accent" : "bg-line",
                  )}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-7 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-surface",
                  done ? "bg-accent text-on-accent" : "bg-surface-2 text-muted ring-1",
                  current && isActive(order.status) && "animate-pulse",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={cn("mt-2 text-xs font-medium", done ? "text-ink" : "text-muted")}>
                {step.label}
              </span>
              <span className="text-[11px] text-muted tnum">{done && at ? timeOnly(at) : " "}</span>
            </li>
          );
        })}
      </ol>
      {order.status === "pending_payment" ? (
        <p className="border-t border-line px-5 py-2.5 text-xs text-muted">
          Waiting for the customer to pay online. Unpaid orders expire after 15 minutes and their
          stock goes back.
        </p>
      ) : null}
    </Card>
  );
}

function Totals({ order, refundedPaise }: { order: AdminOrderDetail; refundedPaise: number }) {
  const rows: { label: string; value: string; muted?: boolean; good?: boolean }[] = [
    { label: "Item total", value: rupees(order.itemTotalPaise) },
  ];
  if (order.savingsPaise > 0) {
    rows.push({
      label: "Saved on MRP",
      value: `−${rupees(order.savingsPaise)}`,
      good: true,
      muted: true,
    });
  }
  rows.push({
    label: "Delivery fee",
    value: order.deliveryFeePaise ? rupees(order.deliveryFeePaise) : "Free",
    good: order.deliveryFeePaise === 0,
  });
  rows.push({ label: "Handling fee", value: rupees(order.handlingFeePaise) });
  if (order.tipPaise) rows.push({ label: "Rider tip", value: rupees(order.tipPaise) });
  return (
    <div className="border-t border-line bg-surface-2/50 px-5 py-4">
      <dl className="ml-auto max-w-xs space-y-1.5 text-[13px]">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-6">
            <dt className="text-muted">{r.label}</dt>
            <dd className={cn("tnum", r.good ? "text-ok" : "text-ink")}>{r.value}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-6 border-t border-line pt-2 text-sm font-semibold">
          <dt>Total</dt>
          <dd className="tnum">{rupees(order.totalPaise)}</dd>
        </div>
        {refundedPaise > 0 ? (
          <>
            <div className="flex justify-between gap-6 text-info">
              <dt>Refunded</dt>
              <dd className="tnum">−{rupees(refundedPaise)}</dd>
            </div>
            <div className="flex justify-between gap-6 font-semibold">
              <dt>Kept</dt>
              <dd className="tnum">{rupees(order.totalPaise - refundedPaise)}</dd>
            </div>
          </>
        ) : null}
      </dl>
    </div>
  );
}

function Timeline({ entries }: { entries: OrderHistoryEntry[] }) {
  if (entries.length === 0) return <p className="text-[13px] text-muted">No history yet.</p>;
  return (
    <ol className="relative space-y-5">
      {entries.map((h, i) => {
        const s = ORDER_STATUS[h.toStatus];
        const last = i === entries.length - 1;
        const bad =
          h.toStatus === "cancelled" || h.toStatus === "expired" || h.toStatus === "payment_failed";
        return (
          <li key={`${h.at}${i}`} className="relative flex gap-4 pl-1">
            {!last ? (
              <span
                className="absolute top-7 bottom-[-1.25rem] left-[15px] w-px bg-line"
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-[22px] shrink-0 items-center justify-center rounded-full ring-4 ring-surface",
                bad
                  ? "bg-bad-soft text-bad ring-1 ring-bad-line"
                  : last
                    ? "bg-accent text-on-accent"
                    : "bg-accent-soft text-accent",
              )}
            >
              {bad ? <XCircle className="size-3.5" /> : <Check className="size-3" />}
            </span>
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-medium text-ink">{s.label}</span>
                <span className="text-xs text-muted tnum" title={dateTime(h.at)}>
                  {dateTime(h.at)}
                </span>
              </div>
              <div className="text-[13px] text-muted">
                {h.actorRole ? (ACTOR[h.actorRole] ?? h.actorRole.replace(/_/g, " ")) : "Automatic"}
                {h.note ? <span className="text-ink-2"> · {h.note}</span> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PaymentCard({
  order,
  payment,
  loading,
  error,
  onRefund,
}: {
  order: AdminOrderDetail;
  payment: AdminPaymentDetail | null;
  loading: boolean;
  error: string | null;
  onRefund: () => void;
}) {
  return (
    <Card
      className="rise"
      title="Payment"
      actions={
        order.paymentMethod === "online" ? (
          <CreditCard className="size-4 text-muted" />
        ) : (
          <Receipt className="size-4 text-muted" />
        )
      }
    >
      {order.paymentMethod === "cod" ? (
        <div className="space-y-1 text-[13px]">
          <div className="font-medium text-ink">Cash on delivery</div>
          <p className="text-muted">
            {order.status === "delivered"
              ? `${rupees(order.totalPaise)} collected at the door.`
              : order.status === "cancelled"
                ? "Nothing to collect."
                : `${rupees(order.totalPaise)} to collect at the door.`}
          </p>
        </div>
      ) : loading ? (
        <p className="text-[13px] text-muted">Loading the payment</p>
      ) : error ? (
        <Callout tone="bad">{error}</Callout>
      ) : !payment ? (
        <p className="text-[13px] text-muted">The customer has not opened the payment yet.</p>
      ) : (
        <div className="space-y-4 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <Badge tone={PAYMENT_STATUS[payment.status].tone}>
              {PAYMENT_STATUS[payment.status].label}
            </Badge>
            <span className="text-base font-semibold text-ink tnum">
              {rupees(payment.amountPaise)}
            </span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {payment.method ? (
              <>
                <dt className="text-muted">Method</dt>
                <dd className="text-ink uppercase">{payment.method}</dd>
              </>
            ) : null}
            {payment.capturedAt ? (
              <>
                <dt className="text-muted">Paid</dt>
                <dd className="text-ink">{dateTime(payment.capturedAt)}</dd>
              </>
            ) : null}
            <dt className="text-muted">Razorpay order</dt>
            <dd className="truncate">
              <Mono>{payment.razorpayOrderId}</Mono>
            </dd>
            {payment.razorpayPaymentId ? (
              <>
                <dt className="text-muted">Payment id</dt>
                <dd className="truncate">
                  <Mono>{payment.razorpayPaymentId}</Mono>
                </dd>
              </>
            ) : null}
            {payment.refundedPaise > 0 ? (
              <>
                <dt className="text-muted">Refunded</dt>
                <dd className="text-info tnum">{rupees(payment.refundedPaise)}</dd>
              </>
            ) : null}
          </dl>
          {payment.errorDescription ? (
            <Callout tone="bad" title="Last attempt failed">
              {payment.errorDescription}
            </Callout>
          ) : null}
          {payment.refunds.length > 0 ? (
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted uppercase">Refunds</div>
              <ul className="space-y-2">
                {payment.refunds.map((r) => (
                  <li key={r.id} className="rounded-lg border border-line px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold tnum">{rupees(r.amountPaise)}</span>
                      <Badge
                        tone={
                          r.status === "processed" ? "ok" : r.status === "failed" ? "bad" : "warn"
                        }
                      >
                        {r.status === "processed"
                          ? "Refunded"
                          : r.status === "failed"
                            ? "Failed"
                            : "Processing"}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {dateTime(r.createdAt)}
                      {r.reason ? ` · ${r.reason}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {payment.refundablePaise > 0 ? (
            <Button className="w-full" icon={RotateCcw} onClick={onRefund}>
              Refund up to {rupees(payment.refundablePaise)}
            </Button>
          ) : null}
        </div>
      )}
    </Card>
  );
}
