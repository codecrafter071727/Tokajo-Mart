"use client";

import type { AdminPaymentsResponse, StockAlertsResponse } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAttention, type AttentionItem } from "../../lib/attention";
import { indiaDay } from "../../lib/dates";
import { gw, qs } from "../../lib/gw";
import { cn } from "../ui/core";
import { useWarehouse } from "./warehouse-context";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Bell,
  Bike,
  Boxes,
  CheckCircle2,
  Clock,
  CreditCard,
  Warehouse,
  type IconComponent,
} from "../ui/icons";

type Alert = Pick<AttentionItem, "title" | "detail" | "href" | "rank"> & { kind: string };

const ICON: Record<string, { icon: IconComponent; tone: string }> = {
  late: { icon: Clock, tone: "bg-bad-soft text-bad" },
  out: { icon: Ban, tone: "bg-bad-soft text-bad" },
  no_riders: { icon: Bike, tone: "bg-bad-soft text-bad" },
  closed: { icon: Warehouse, tone: "bg-warn-soft text-warn" },
  unpaid: { icon: CreditCard, tone: "bg-warn-soft text-warn" },
  low: { icon: Boxes, tone: "bg-warn-soft text-warn" },
  payment_failed: { icon: AlertCircle, tone: "bg-bad-soft text-bad" },
  expired: { icon: AlertTriangle, tone: "bg-bad-soft text-bad" },
  expiring: { icon: Clock, tone: "bg-warn-soft text-warn" },
};

/** Stock past or near its expiry date, for the warehouse in view (or all), every minute. */
function useExpiryAlerts(): Alert[] {
  const { warehouseId } = useWarehouse();
  const alerts = useQuery({
    queryKey: ["bell-expiry", warehouseId],
    refetchInterval: 60_000,
    queryFn: () =>
      gw<StockAlertsResponse>(
        "GET",
        `/v1/inventory/alerts${qs({ warehouseId: warehouseId || undefined, expiryDays: 3 })}`,
      ),
  });
  const counts = alerts.data?.counts;
  const out: Alert[] = [];
  if (counts?.expired) {
    out.push({
      kind: "expired",
      title: `${counts.expired} ${counts.expired === 1 ? "batch is" : "batches are"} past expiry`,
      detail: "Take them off the shelf and write them off",
      href: "/inventory",
      rank: 1,
    });
  }
  if (counts?.expiring) {
    out.push({
      kind: "expiring",
      title: `${counts.expiring} ${counts.expiring === 1 ? "batch expires" : "batches expire"} within 3 days`,
      detail: "Sell these first or plan a markdown",
      href: "/inventory",
      rank: 3,
    });
  }
  return out;
}

/** Failed online payments today, refreshed every minute. */
function usePaymentAlerts(): Alert[] {
  const today = indiaDay(0);
  const failed = useQuery({
    queryKey: ["bell-payments", today],
    refetchInterval: 60_000,
    queryFn: () =>
      gw<AdminPaymentsResponse>(
        "GET",
        `/v1/payments/admin${qs({ status: "failed", from: today, to: today, limit: 1 })}`,
      ),
  });
  const n = failed.data?.stats.failedCount ?? 0;
  return n
    ? [
        {
          kind: "payment_failed",
          title: `${n} online ${n === 1 ? "payment" : "payments"} failed today`,
          detail: "Customers can retry for 15 minutes before the order expires",
          href: "/payments",
          rank: 2,
        },
      ]
    : [];
}

/** The bell in the top bar: everything that needs someone now, most urgent first. */
export function AlertsBell() {
  const attention = useAttention();
  const payments = usePaymentAlerts();
  const expiry = useExpiryAlerts();
  const [open, setOpen] = useState(false);
  const items: Alert[] = [...attention.items, ...payments, ...expiry].sort(
    (a, b) => a.rank - b.rank,
  );
  const urgent = items.filter((i) => i.rank <= 2).length;

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  const label = items.length ? `${items.length} things need attention` : "Nothing needs attention";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        title={label}
        className="relative flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Bell className="size-[18px]" />
        {items.length > 0 ? (
          <span
            className={cn(
              "tnum absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ring-2 ring-canvas",
              urgent ? "bg-bad text-white" : "bg-warn text-white",
            )}
          >
            {items.length > 99 ? "99+" : items.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="Alerts"
            className="absolute top-full right-0 z-40 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-semibold text-ink">Needs attention</span>
              <span className="text-xs text-muted">Updates on its own</span>
            </div>
            {items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-ok-soft text-ok">
                  <CheckCircle2 className="size-5" />
                </span>
                <span className="text-sm font-medium text-ink">All clear</span>
                <span className="text-xs text-muted">
                  {attention.loading ? "Checking" : "Nothing is late, out of stock or stuck."}
                </span>
              </div>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
                {items.map((item, i) => {
                  const look = ICON[item.kind] ?? {
                    icon: AlertTriangle,
                    tone: "bg-warn-soft text-warn",
                  };
                  const Icon = look.icon;
                  return (
                    <li key={`${item.kind}${item.title}${i}`}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                            look.tone,
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-ink">
                            {item.title}
                          </span>
                          <span className="block text-xs text-muted">{item.detail}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              href="/dashboard#attention"
              onClick={() => setOpen(false)}
              className="block border-t border-line px-4 py-2.5 text-center text-[13px] font-medium text-accent hover:bg-surface-2"
            >
              Open the overview
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
