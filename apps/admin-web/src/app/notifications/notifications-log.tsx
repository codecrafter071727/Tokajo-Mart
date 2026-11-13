"use client";

import type { AdminNotificationsResponse } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  Badge,
  Callout,
  Card,
  cn,
  EmptyState,
  Mono,
  Stat,
  type Tone,
} from "../../components/ui/core";
import { Bell, Clock, Inbox, Mail } from "../../components/ui/icons";
import { PageHeader } from "../../components/ui/layout";
import { TableSkeleton } from "../../components/ui/skeleton";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/table";
import { dateTime, timeAgo } from "../../lib/format";
import { errorMessage, gw, qs } from "../../lib/gw";

/** Each kind of notification, as the team reads it. */
const KINDS: Record<string, { label: string; tone: Tone }> = {
  "order.confirmed": { label: "Order confirmed", tone: "info" },
  "order.packing": { label: "Packing", tone: "warn" },
  "delivery.rider_assigned": { label: "Rider assigned", tone: "info" },
  "order.out_for_delivery": { label: "Out for delivery", tone: "warn" },
  "order.delivered": { label: "Delivered", tone: "ok" },
  "order.cancelled": { label: "Cancelled", tone: "bad" },
  "order.refunded": { label: "Refund", tone: "neutral" },
  "stock.back_in_stock": { label: "Back in stock", tone: "accent" },
};

const FILTERS = [{ value: "", label: "All" }].concat(
  Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label })),
);

/** What customers have been told, newest first, so support can see exactly what someone saw. */
export function NotificationsLog() {
  const [type, setType] = useState("");
  const list = useQuery({
    queryKey: ["admin-notifications", type],
    queryFn: () =>
      gw<AdminNotificationsResponse>(
        "GET",
        `/v1/notifications/admin${qs({ type: type || undefined, limit: 150 })}`,
      ),
    refetchInterval: 30_000,
  });
  const items = list.data?.items ?? [];
  const counts = list.data?.counts;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Everything customers were told in the app: order updates and back in stock alerts. Push and SMS are not switched on yet."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          delay={0}
          icon={Bell}
          label="Sent in the last 24 hours"
          value={counts?.last24h ?? "-"}
        />
        <Stat
          delay={1}
          icon={Mail}
          label="Not opened yet"
          value={counts?.unread ?? "-"}
          hint="Across all customers"
        />
        <Stat
          delay={2}
          icon={Clock}
          label="Waiting for an item"
          value={counts?.openSubscriptions ?? "-"}
          hint="Notify me requests not yet sent"
        />
      </div>

      <Card
        flush
        title="Recent notifications"
        actions={
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by kind">
            {FILTERS.map((f) => (
              <button
                key={f.value || "all"}
                type="button"
                aria-pressed={type === f.value}
                onClick={() => setType(f.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                  type === f.value
                    ? "border-accent-line bg-accent-soft text-accent"
                    : "border-line bg-surface text-ink-2 hover:bg-surface-2",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        {list.isLoading ? (
          <TableSkeleton rows={6} cols={5} toolbar={false} />
        ) : list.isError ? (
          <div className="p-5">
            <Callout tone="bad" title="Could not load notifications">
              {errorMessage(list.error)}
            </Callout>
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Inbox className="size-5" />} title="Nothing sent yet">
            Notifications appear here as orders move and items come back in stock.
          </EmptyState>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Sent</Th>
                <Th>Kind</Th>
                <Th>Message</Th>
                <Th>Customer</Th>
                <Th>Opened</Th>
              </tr>
            </THead>
            <TBody>
              {items.map((n) => {
                const kind = KINDS[n.type] ?? { label: n.type, tone: "neutral" as Tone };
                const orderId = typeof n.data.orderId === "string" ? n.data.orderId : null;
                return (
                  <Tr key={n.id}>
                    <Td>
                      <span className="tnum text-ink" title={dateTime(n.createdAt)}>
                        {timeAgo(n.createdAt)}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={kind.tone}>{kind.label}</Badge>
                    </Td>
                    <Td>
                      <div className="max-w-md">
                        <div className="font-medium text-ink">{n.title}</div>
                        {n.body ? (
                          <div className="truncate text-[13px] text-muted">{n.body}</div>
                        ) : null}
                        {orderId ? (
                          <Link
                            href={`/orders/${orderId}`}
                            className="text-[13px] font-medium text-accent hover:underline"
                          >
                            {typeof n.data.orderNumber === "string"
                              ? n.data.orderNumber
                              : "Open order"}
                          </Link>
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      <Link href={`/customers/${n.userId}`} className="hover:underline">
                        <Mono>{n.userId.slice(0, 8)}</Mono>
                      </Link>
                    </Td>
                    <Td>
                      {n.readAt ? (
                        <span className="text-[13px] text-muted">{timeAgo(n.readAt)}</span>
                      ) : (
                        <Badge tone="neutral" dot={false}>
                          Not yet
                        </Badge>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
