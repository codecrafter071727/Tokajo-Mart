"use client";

import type { AdminOrder, OrderSummary } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Segmented } from "../../components/kit";
import { useWarehouse } from "../../components/shell/warehouse-context";
import { Ring, TrendChart } from "../../components/ui/charts";
import {
  Badge,
  ButtonLink,
  Callout,
  Card,
  EmptyState,
  Stat,
  type Tone,
} from "../../components/ui/core";
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Bike,
  Boxes,
  CheckCircle2,
  Clock,
  CreditCard,
  IndianRupee,
  Percent,
  TrendingUp,
  ShoppingBag,
  Timer,
  Warehouse,
  type IconComponent,
} from "../../components/ui/icons";
import { PageHeader } from "../../components/ui/layout";
import { OverviewSkeleton } from "../../components/ui/skeleton";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/table";
import { rupees } from "../../lib/api";
import {
  useAttention,
  useLiveOrders,
  useRidersLive,
  type AttentionKind,
} from "../../lib/attention";
import { indiaDay, RANGES, type RangeKey } from "../../lib/dates";
import { errorMessage, gw, qs } from "../../lib/gw";
import { ORDER_STATUS } from "../../lib/order-status";

const ACTIVE = ["confirmed", "packing", "packed", "picked_up", "out_for_delivery"];

/** The period chosen, and the one just before it of the same length, for the change figures. */
function periods(key: RangeKey) {
  const days = RANGES.find((r) => r.key === key)?.days ?? 7;
  return {
    days,
    now: { from: indiaDay(-(days - 1)), to: indiaDay(0) },
    before: { from: indiaDay(-(2 * days - 1)), to: indiaDay(-days) },
  };
}

function change(now: number, before: number): { delta?: string; up: boolean } {
  if (!before) return { up: true };
  const pct = Math.round(((now - before) / before) * 100);
  return { delta: `${pct >= 0 ? "+" : ""}${pct}%`, up: pct >= 0 };
}

const minutesAgo = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
const ago = (iso: string) => {
  const m = minutesAgo(iso);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
};

export function Dashboard() {
  const { warehouseId, nameOf } = useWarehouse();
  const [range, setRange] = useState<RangeKey>("7d");
  const p = periods(range);
  const scope = warehouseId || undefined;

  const summary = useQuery({
    queryKey: ["summary", p.now.from, p.now.to, warehouseId],
    refetchInterval: 30_000,
    queryFn: () =>
      gw<OrderSummary>("GET", `/v1/orders/admin/summary${qs({ ...p.now, warehouseId: scope })}`),
  });
  const previous = useQuery({
    queryKey: ["summary", p.before.from, p.before.to, warehouseId],
    staleTime: 5 * 60_000,
    queryFn: () =>
      gw<OrderSummary>("GET", `/v1/orders/admin/summary${qs({ ...p.before, warehouseId: scope })}`),
  });

  const where = warehouseId ? nameOf(warehouseId) : "every warehouse";
  return (
    <>
      <PageHeader
        title="Overview"
        description={`Orders, sales and what needs attention at ${where}. Days are India local days.`}
        actions={
          <>
            <Segmented
              label="Date range"
              options={RANGES.map((r) => ({ value: r.key, label: r.label }))}
              value={range}
              onChange={setRange}
            />
            <ButtonLink href="/orders" variant="primary">
              Live orders
            </ButtonLink>
          </>
        }
      />
      {summary.isError ? (
        <Callout tone="bad" title="Could not load the overview">
          {errorMessage(summary.error)}
        </Callout>
      ) : summary.isPending ? (
        <OverviewSkeleton />
      ) : (
        <Report data={summary.data} before={previous.data} days={p.days} />
      )}
    </>
  );
}

function Report({
  data,
  before,
  days,
}: {
  data: OrderSummary;
  before: OrderSummary | undefined;
  days: number;
}) {
  const { nameOf, warehouseId } = useWarehouse();
  const [metric, setMetric] = useState<"orders" | "gmv">("orders");
  const t = data.totals;
  const b = before?.totals;
  const vs = days === 1 ? "vs yesterday" : `vs the ${days} days before`;
  const orders = change(t.orders, b?.orders ?? 0);
  const gmv = change(t.gmvPaise, b?.gmvPaise ?? 0);
  const aov = change(t.averageOrderPaise, b?.averageOrderPaise ?? 0);

  const inProgress = ACTIVE.reduce((n, s) => n + (data.byStatus[s] ?? 0), 0);
  const ring = [
    { name: "In progress", value: inProgress, color: "var(--chart-3)" },
    { name: "Delivered", value: data.byStatus.delivered ?? 0, color: "var(--chart-2)" },
    {
      name: "Cancelled or failed",
      value:
        (data.byStatus.cancelled ?? 0) +
        (data.byStatus.payment_failed ?? 0) +
        (data.byStatus.expired ?? 0),
      color: "var(--chart-4)",
    },
    {
      name: "Awaiting payment",
      value: data.byStatus.pending_payment ?? 0,
      color: "var(--chart-1)",
    },
  ];
  const trend = data.daily.map((d) => ({
    date: d.date,
    value: metric === "orders" ? d.orders : d.gmvPaise / 100,
  }));
  const trendTotal = metric === "orders" ? t.orders : t.gmvPaise;
  const deliveredShare = t.orders
    ? Math.round(((data.byStatus.delivered ?? 0) / t.orders) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Stat
          delay={0}
          icon={ShoppingBag}
          label="Orders"
          value={t.orders}
          delta={orders.delta}
          deltaTone={orders.up ? "up" : "down"}
          hint={`${t.active} in progress · ${vs}`}
          href="/orders"
        />
        <Stat
          delay={1}
          icon={IndianRupee}
          label="Delivered sales"
          value={rupees(t.gmvPaise)}
          delta={gmv.delta}
          deltaTone={gmv.up ? "up" : "down"}
          hint={`${t.delivered} delivered`}
        />
        <Stat
          delay={2}
          icon={TrendingUp}
          label="Average order"
          value={t.delivered ? rupees(t.averageOrderPaise) : "None yet"}
          delta={t.delivered ? aov.delta : undefined}
          deltaTone={aov.up ? "up" : "down"}
          hint="Delivered orders only"
        />
        <Stat
          delay={3}
          icon={Percent}
          label="Cancel rate"
          value={`${t.cancelRatePercent}%`}
          hint={`${t.cancelled} cancelled`}
          tone={t.cancelRatePercent > 5 ? "bad" : t.cancelRatePercent > 2 ? "warn" : "ok"}
        />
        <Stat
          delay={4}
          icon={Timer}
          label="Average delivery"
          value={
            t.averageDeliveryMins === null
              ? "None yet"
              : t.averageDeliveryMins < 1
                ? "Under 1 min"
                : `${t.averageDeliveryMins} min`
          }
          hint="Placed to delivered"
        />
        <Stat
          delay={5}
          icon={Clock}
          label="On time"
          value={t.onTimePercent === null ? "None yet" : `${t.onTimePercent}%`}
          hint="Within the promised time"
          tone={
            t.onTimePercent === null
              ? undefined
              : t.onTimePercent >= 90
                ? "ok"
                : t.onTimePercent >= 75
                  ? "warn"
                  : "bad"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="rise lg:col-span-2"
          title={metric === "orders" ? "Orders" : "Delivered sales"}
          description={`Per day, last ${data.daily.length} ${data.daily.length === 1 ? "day" : "days"}`}
          actions={
            <span className="flex flex-wrap items-center gap-3">
              <span className="tnum text-2xl font-bold text-ink">
                {metric === "orders" ? trendTotal : rupees(trendTotal)}
              </span>
              <Segmented
                label="Chart"
                options={[
                  { value: "orders", label: "Orders" },
                  { value: "gmv", label: "Sales" },
                ]}
                value={metric}
                onChange={setMetric}
              />
            </span>
          }
        >
          {data.daily.every((d) => d.orders === 0) ? (
            <div className="flex h-[260px] items-center justify-center text-[13px] text-muted">
              No orders in this period yet.
            </div>
          ) : (
            <TrendChart
              data={trend}
              name={metric === "orders" ? "Orders" : "Delivered sales"}
              color={metric === "orders" ? "var(--chart-1)" : "var(--chart-2)"}
              format={(v) => (metric === "orders" ? String(v) : rupees(Math.round(v * 100)))}
            />
          )}
        </Card>
        <Card className="rise" title="Order status" description="Everything placed in this period">
          <Ring
            parts={ring}
            centre={`${deliveredShare}%`}
            caption="delivered"
            label={ring.map((r) => `${r.value} ${r.name.toLowerCase()}`).join(", ")}
          />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <AttentionCard className="rise lg:col-span-2" />
        <LiveCard className="rise lg:col-span-3" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          className="rise"
          title="Top products"
          description="By revenue, cancelled orders left out"
          flush
        >
          {data.topProducts.length === 0 ? (
            <EmptyState icon={<Boxes className="size-5" />} title="Nothing sold yet">
              Products appear here once orders come in.
            </EmptyState>
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th className="w-10">#</Th>
                  <Th>Product</Th>
                  <Th align="right">Units</Th>
                  <Th align="right">Revenue</Th>
                </tr>
              </THead>
              <TBody>
                {data.topProducts.map((p, i) => (
                  <Tr key={p.productId}>
                    <Td muted num>
                      {i + 1}
                    </Td>
                    <Td className="font-medium">{p.name}</Td>
                    <Td align="right">{p.quantity}</Td>
                    <Td align="right" className="font-semibold">
                      {rupees(p.revenuePaise)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        {warehouseId ? (
          <RidersCard />
        ) : (
          <Card
            className="rise"
            title="By warehouse"
            description="Orders and delivered sales"
            flush
          >
            {data.byWarehouse.length === 0 ? (
              <EmptyState icon={<Warehouse className="size-5" />} title="No orders yet">
                Each warehouse shows here once it has orders.
              </EmptyState>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <Th>Warehouse</Th>
                    <Th align="right">Orders</Th>
                    <Th align="right">Delivered sales</Th>
                    <Th className="w-40">Share of orders</Th>
                  </tr>
                </THead>
                <TBody>
                  {data.byWarehouse.map((w) => (
                    <Tr key={w.warehouseId}>
                      <Td className="font-medium">{nameOf(w.warehouseId)}</Td>
                      <Td align="right">{w.orders}</Td>
                      <Td align="right" className="font-semibold">
                        {rupees(w.gmvPaise)}
                      </Td>
                      <Td>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-line ring-inset">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{
                              width: `${t.orders ? Math.round((w.orders / t.orders) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

const ATTENTION_ICON: Record<AttentionKind, IconComponent> = {
  late: Clock,
  unpaid: CreditCard,
  out: Ban,
  low: AlertTriangle,
  closed: Warehouse,
  no_riders: Bike,
};
const ATTENTION_COLOUR: Record<AttentionKind, string> = {
  late: "text-bad",
  unpaid: "text-info",
  out: "text-bad",
  low: "text-warn",
  closed: "text-bad",
  no_riders: "text-bad",
};

/** Everything someone should act on now, most urgent first. The bell in the top bar counts these. */
function AttentionCard({ className }: { className?: string }) {
  const { items, loading } = useAttention();
  const shown = items.slice(0, 8);
  return (
    <section id="attention" className={`scroll-mt-20 ${className ?? ""}`}>
      <Card
        className="h-full"
        title="Needs attention"
        description="Act on these before customers notice."
        actions={items.length ? <Badge tone="warn">{items.length}</Badge> : null}
        flush
      >
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-line/70" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="size-5" />} title="All clear">
            No late orders, stock outs or closed warehouses right now.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((x, i) => {
              const Icon = ATTENTION_ICON[x.kind];
              return (
                <li key={`${x.kind}${i}`}>
                  <Link
                    href={x.href}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-surface-2"
                  >
                    <Icon className={`mt-0.5 size-4 shrink-0 ${ATTENTION_COLOUR[x.kind]}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-ink">
                        {x.title}
                      </span>
                      <span className="block text-[13px] text-muted">{x.detail}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {items.length > shown.length ? (
              <li className="px-5 py-2.5 text-xs text-muted">
                And {items.length - shown.length} more
              </li>
            ) : null}
          </ul>
        )}
      </Card>
    </section>
  );
}

/** Orders being worked on right now, newest first, refreshed every 20 seconds. */
function LiveCard({ className }: { className?: string }) {
  const { nameOf, warehouseId } = useWarehouse();
  const live = useLiveOrders();
  const active: AdminOrder[] = (live.data?.items ?? []).filter((o) => ACTIVE.includes(o.status));
  return (
    <Card
      className={className}
      title="Happening now"
      description={`${active.length} ${active.length === 1 ? "order is" : "orders are"} being packed or delivered`}
      actions={
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          All orders <ArrowUpRight className="size-4" />
        </Link>
      }
      flush
    >
      {live.isPending ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-line/70" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="size-5" />} title="Nothing in progress">
          New orders show here the moment they are placed.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {active.slice(0, 6).map((o) => {
            const late = minutesAgo(o.placedAt) > o.promisedMins;
            const status = ORDER_STATUS[o.status];
            return (
              <li key={o.id}>
                <Link
                  href={`/orders?q=${encodeURIComponent(o.number)}`}
                  className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted transition-colors group-hover:bg-accent-soft group-hover:text-accent">
                    <ShoppingBag className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {o.number}
                      <span className="font-normal text-muted">
                        {" "}
                        · {o.customerName || "Customer"}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {o.items.reduce((n, i) => n + i.quantity, 0)} items · {rupees(o.totalPaise)}
                      {warehouseId ? "" : ` · ${nameOf(o.warehouseId)}`} · {ago(o.placedAt)}
                    </span>
                  </span>
                  {late ? <Badge tone="bad">Late</Badge> : null}
                  <Badge tone={status.tone}>{status.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const RIDER_TONE = {
  online: "ok",
  on_delivery: "warn",
  offline: "neutral",
} as const satisfies Record<string, Tone>;
const RIDER_LABEL = { online: "Free", on_delivery: "On a delivery", offline: "Offline" } as const;

/** For one warehouse: who is on shift right now. */
function RidersCard() {
  const riders = useRidersLive();
  const list = riders.data?.items ?? [];
  const working = list.filter((r) => r.status !== "offline").length;
  return (
    <Card
      className="rise"
      title="Riders"
      description={`${working} of ${list.length} working now`}
      actions={
        <Link
          href="/riders"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          All riders <ArrowUpRight className="size-4" />
        </Link>
      }
      flush
    >
      {list.length === 0 ? (
        <EmptyState icon={<Bike className="size-5" />} title="No riders here yet">
          Add riders for this warehouse from the Riders page.
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Rider</Th>
              <Th>Status</Th>
              <Th align="right">Today</Th>
              <Th align="right">Rating</Th>
            </tr>
          </THead>
          <TBody>
            {list.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium">{r.name}</Td>
                <Td>
                  <Badge tone={RIDER_TONE[r.status]}>{RIDER_LABEL[r.status]}</Badge>
                </Td>
                <Td align="right">{r.deliveriesToday}</Td>
                <Td align="right">{r.rating.toFixed(1)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
