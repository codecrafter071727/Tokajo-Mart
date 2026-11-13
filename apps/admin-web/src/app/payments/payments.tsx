"use client";

import type { AdminPayment, AdminPaymentsResponse, PaymentStatus } from "@qc/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PAYMENT_STATUS, RefundDialog } from "../../components/orders/order-ui";
import { Badge, Button, Callout, Card, EmptyState, Mono, Stat, cn } from "../../components/ui/core";
import { Dialog } from "../../components/ui/dialog";
import {
  AlertCircle,
  ArrowUpRight,
  Clock,
  CreditCard,
  IndianRupee,
  RotateCcw,
  Search,
  X,
} from "../../components/ui/icons";
import { PageHeader } from "../../components/ui/layout";
import { TableSkeleton } from "../../components/ui/skeleton";
import { Table, TBody, Td, Th, THead } from "../../components/ui/table";
import { usePaymentDetail } from "../../lib/admin-orders";
import { rupees } from "../../lib/api";
import { indiaDay } from "../../lib/dates";
import { dateTime, timeAgo } from "../../lib/format";
import { errorMessage, gw, qs } from "../../lib/gw";
import { useDebounced } from "../../lib/users";

const RANGES = [
  { id: "today", label: "Today", days: 1 },
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "all", label: "All time", days: 0 },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

const STATUSES: { id: PaymentStatus | ""; label: string }[] = [
  { id: "", label: "All" },
  { id: "captured", label: "Paid" },
  { id: "created", label: "Awaiting" },
  { id: "failed", label: "Failed" },
  { id: "partially_refunded", label: "Part refunded" },
  { id: "refunded", label: "Refunded" },
];

export function Payments() {
  const [range, setRange] = useState<RangeId>("today");
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const days = RANGES.find((r) => r.id === range)?.days ?? 0;
  const filter = {
    status: status || undefined,
    q: q || undefined,
    from: days ? indiaDay(-(days - 1)) : undefined,
    to: days ? indiaDay(0) : undefined,
  };
  const list = useInfiniteQuery({
    queryKey: ["admin-payments", filter],
    initialPageParam: undefined as string | undefined,
    refetchInterval: 30_000,
    queryFn: ({ pageParam }) =>
      gw<AdminPaymentsResponse>(
        "GET",
        `/v1/payments/admin${qs({ ...filter, limit: 50, cursor: pageParam })}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const payments = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const stats = list.data?.pages[0]?.stats;
  const rangeLabel = RANGES.find((r) => r.id === range)?.label.toLowerCase() ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Online payments through Razorpay, with refunds. Cash on delivery orders are on the orders page."
      />
      {notice ? <Callout tone="ok">{notice}</Callout> : null}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat
          delay={0}
          icon={IndianRupee}
          label={`Collected, ${rangeLabel}`}
          value={stats ? rupees(stats.capturedPaise) : "…"}
          hint={stats ? `${stats.capturedCount} payments` : " "}
        />
        <Stat
          delay={1}
          icon={RotateCcw}
          label="Refunded"
          value={stats ? rupees(stats.refundedPaise) : "…"}
          hint={
            stats && stats.capturedPaise
              ? `${Math.round((stats.refundedPaise / stats.capturedPaise) * 100)}% of collected`
              : "Nothing collected yet"
          }
        />
        <Stat
          delay={2}
          icon={AlertCircle}
          label="Failed"
          value={stats?.failedCount ?? "…"}
          tone={stats?.failedCount ? "bad" : "ok"}
          hint="The customer can retry for 15 minutes"
        />
        <Stat
          delay={3}
          icon={Clock}
          label="Awaiting payment"
          value={stats?.pendingCount ?? "…"}
          tone={stats?.pendingCount ? "warn" : undefined}
          hint="Checkout opened, not paid yet"
        />
      </div>

      <Card className="rise" flush>
        <div className="space-y-3 border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Order number, customer or Razorpay id"
                aria-label="Search payments"
                className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-8 pl-9 text-sm text-ink shadow-card placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
              />
              {search ? (
                <button
                  type="button"
                  aria-label="Clear the search"
                  onClick={() => setSearch("")}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <div
              className="ml-auto inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-[13px]"
              role="group"
              aria-label="Date range"
            >
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={range === r.id}
                  onClick={() => setRange(r.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-medium transition-colors",
                    range === r.id
                      ? "bg-surface text-ink shadow-card ring-1 ring-line"
                      : "text-muted hover:text-ink",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Status">
            {STATUSES.map((s) => (
              <button
                key={s.id || "all"}
                type="button"
                aria-pressed={status === s.id}
                onClick={() => setStatus(s.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                  status === s.id
                    ? "border-accent-line bg-accent-soft text-accent"
                    : "border-line bg-surface text-ink-2 hover:bg-surface-2",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {list.isError ? (
          <div className="p-4">
            <Callout tone="bad" title="Could not load payments">
              {errorMessage(list.error)}
            </Callout>
          </div>
        ) : list.isPending ? (
          <TableSkeleton cols={7} rows={8} />
        ) : payments.length === 0 ? (
          <EmptyState icon={<CreditCard className="size-5" />} title="No payments here">
            {q ? `Nothing matches "${q}".` : "Online payments show here as customers pay."}
          </EmptyState>
        ) : (
          <Table maxHeight="calc(100vh - 22rem)">
            <THead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th align="right">Amount</Th>
                <Th align="right" className="hidden lg:table-cell">
                  Refunded
                </Th>
                <Th className="hidden xl:table-cell">Method</Th>
                <Th>Status</Th>
                <Th className="hidden xl:table-cell">Razorpay payment</Th>
                <Th align="right">Started</Th>
              </tr>
            </THead>
            <TBody>
              {payments.map((p) => (
                <PaymentRow key={p.orderId} p={p} onOpen={() => setOpen(p.orderId)} />
              ))}
            </TBody>
          </Table>
        )}
        {list.hasNextPage ? (
          <div className="border-t border-line px-4 py-3">
            <Button
              size="sm"
              pending={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              Load more
            </Button>
          </div>
        ) : null}
      </Card>

      {open ? (
        <PaymentDrawer
          orderId={open}
          onClose={() => setOpen(null)}
          onRefunded={(message) => setNotice(message)}
        />
      ) : null}
    </div>
  );
}

/** A checkout nobody paid within the 15 minute window will never be paid */
const abandoned = (p: AdminPayment) =>
  p.status === "created" && Date.now() - Date.parse(p.createdAt) > 15 * 60_000;

function PaymentRow({ p, onOpen }: { p: AdminPayment; onOpen: () => void }) {
  const s = abandoned(p)
    ? { label: "Not completed", tone: "neutral" as const }
    : PAYMENT_STATUS[p.status];
  return (
    <tr onClick={onOpen} className="group cursor-pointer transition-colors hover:bg-surface-2">
      <Td className="font-semibold tnum whitespace-nowrap">{p.orderNumber ?? "Order"}</Td>
      <Td className="whitespace-nowrap">
        <div className="leading-tight">
          <div>{p.customerName || "Customer"}</div>
          <div className="text-xs text-muted tnum">{p.customerPhone}</div>
        </div>
      </Td>
      <Td align="right" className="font-semibold">
        {rupees(p.amountPaise)}
      </Td>
      <Td align="right" muted={!p.refundedPaise} className="hidden md:table-cell">
        {p.refundedPaise ? <span className="text-info">{rupees(p.refundedPaise)}</span> : "None"}
      </Td>
      <Td muted className="hidden uppercase xl:table-cell">
        {p.method ?? ""}
      </Td>
      <Td>
        <Badge tone={s.tone}>{s.label}</Badge>
      </Td>
      <Td className="hidden xl:table-cell">
        {p.razorpayPaymentId ? (
          <Mono>{p.razorpayPaymentId}</Mono>
        ) : (
          <span className="text-muted">Not paid</span>
        )}
      </Td>
      <Td align="right" muted className="whitespace-nowrap">
        <span title={dateTime(p.createdAt)}>{timeAgo(p.createdAt)}</span>
      </Td>
    </tr>
  );
}

function PaymentDrawer({
  orderId,
  onClose,
  onRefunded,
}: {
  orderId: string;
  onClose: () => void;
  onRefunded: (message: string) => void;
}) {
  const detail = usePaymentDetail(orderId, true);
  const [refunding, setRefunding] = useState(false);
  const p = detail.data;
  return (
    <>
      <Dialog
        side
        title={p ? `Payment for ${p.orderNumber ?? "order"}` : "Payment"}
        description={
          p ? `${p.customerName ?? "Customer"} · started ${dateTime(p.createdAt)}` : undefined
        }
        onClose={onClose}
        footer={
          p ? (
            <>
              <Link
                href={`/orders/${p.orderId}`}
                className="mr-auto inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
              >
                Open the order <ArrowUpRight className="size-3.5" />
              </Link>
              {p.refundablePaise > 0 ? (
                <Button variant="primary" icon={RotateCcw} onClick={() => setRefunding(true)}>
                  Refund
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {detail.isPending ? (
          <p className="text-[13px] text-muted">Loading</p>
        ) : detail.isError ? (
          <Callout tone="bad">{errorMessage(detail.error)}</Callout>
        ) : !p ? (
          <Callout tone="info">This order has no online payment.</Callout>
        ) : (
          <div className="space-y-6 text-[13px]">
            <div className="rounded-xl border border-line bg-surface-2/60 p-4">
              <div className="flex items-center justify-between">
                <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                <span className="text-2xl font-bold text-ink tnum">{rupees(p.amountPaise)}</span>
              </div>
              {p.refundedPaise > 0 ? (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface ring-1 ring-line">
                  <div
                    className="h-full bg-info"
                    style={{ width: `${(p.refundedPaise / p.amountPaise) * 100}%` }}
                  />
                </div>
              ) : null}
              <div className="mt-2 flex justify-between text-xs text-muted">
                <span>Refunded {rupees(p.refundedPaise)}</span>
                <span>Can still refund {rupees(p.refundablePaise)}</span>
              </div>
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5">
              <dt className="text-muted">Customer</dt>
              <dd className="text-ink">
                <Link href={`/customers/${p.userId}`} className="hover:text-accent hover:underline">
                  {p.customerName || "Customer"}
                </Link>
                {p.customerPhone ? (
                  <span className="text-muted tnum"> · {p.customerPhone}</span>
                ) : null}
              </dd>
              <dt className="text-muted">Method</dt>
              <dd className="text-ink uppercase">{p.method ?? "Not paid yet"}</dd>
              <dt className="text-muted">Paid at</dt>
              <dd className="text-ink">{p.capturedAt ? dateTime(p.capturedAt) : "Not paid yet"}</dd>
              <dt className="text-muted">Razorpay order</dt>
              <dd>
                <Mono>{p.razorpayOrderId}</Mono>
              </dd>
              <dt className="text-muted">Payment id</dt>
              <dd>
                {p.razorpayPaymentId ? (
                  <Mono>{p.razorpayPaymentId}</Mono>
                ) : (
                  <span className="text-muted">None</span>
                )}
              </dd>
            </dl>

            {p.errorDescription ? (
              <Callout tone="bad" title={`Failed${p.errorCode ? ` (${p.errorCode})` : ""}`}>
                {p.errorDescription}
              </Callout>
            ) : null}

            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted uppercase">Refunds</h3>
              {p.refunds.length === 0 ? (
                <p className="text-muted">No refunds.</p>
              ) : (
                <ul className="space-y-2">
                  {p.refunds.map((r) => (
                    <li key={r.id} className="rounded-lg border border-line px-3 py-2.5">
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
                      <div className="mt-1 text-xs text-muted">
                        {dateTime(r.createdAt)} · {r.actorId ? "By an admin" : "On cancellation"}
                        {r.reason ? ` · ${r.reason}` : ""}
                      </div>
                      {r.razorpayRefundId ? (
                        <div className="mt-1">
                          <Mono>{r.razorpayRefundId}</Mono>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Dialog>
      {refunding && p ? (
        <RefundDialog
          orderId={p.orderId}
          orderNumber={p.orderNumber ?? "order"}
          refundablePaise={p.refundablePaise}
          onClose={() => setRefunding(false)}
          onDone={(message) => {
            setRefunding(false);
            onRefunded(message);
          }}
        />
      ) : null}
    </>
  );
}
