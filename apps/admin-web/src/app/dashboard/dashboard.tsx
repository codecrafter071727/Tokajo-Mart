"use client";

import type { AdminWarehouse, OrderSummary } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, TableShell, th, td, Toolbar } from "../../components/ui";
import { rupees } from "../../lib/api";
import { rangeFor, RANGES, shortDate, type RangeKey } from "../../lib/dates";
import { errorMessage, gw, qs } from "../../lib/gw";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  packing: "Packing",
  packed: "Packed",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  pending_payment: "Awaiting payment",
  payment_failed: "Payment failed",
  expired: "Expired",
};

export function Dashboard() {
  const [range, setRange] = useState<RangeKey>("7d");
  const [warehouseId, setWarehouseId] = useState("");
  const { from, to } = rangeFor(range);

  const warehouses = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => gw<{ items: AdminWarehouse[] }>("GET", "/v1/inventory/warehouses"),
  });
  const summary = useQuery({
    queryKey: ["summary", from, to, warehouseId],
    queryFn: () =>
      gw<OrderSummary>("GET", `/v1/orders/admin/summary${qs({ from, to, warehouseId })}`),
    refetchInterval: 30_000,
  });

  return (
    <>
      <Toolbar>
        <div role="group" aria-label="Date range" className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                range === r.key
                  ? "border-brand-600 bg-brand-100 text-brand-900"
                  : "border-line bg-white text-ink-700"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Warehouse"
          value={warehouseId}
          onChange={(event) => setWarehouseId(event.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold"
        >
          <option value="">All warehouses</option>
          {warehouses.data?.items.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-500">
          {shortDate(from)} to {shortDate(to)}
        </span>
      </Toolbar>

      {summary.isError ? (
        <Alert>{errorMessage(summary.error)}</Alert>
      ) : summary.isPending ? (
        <Skeleton />
      ) : (
        <Report data={summary.data} warehouseNames={warehouses.data?.items ?? []} />
      )}
    </>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading the report">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-white" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-white" />
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

function Report({
  data,
  warehouseNames,
}: {
  data: OrderSummary;
  warehouseNames: AdminWarehouse[];
}) {
  const t = data.totals;
  const nameOf = (id: string) => warehouseNames.find((w) => w.id === id)?.name ?? id;
  const statuses = Object.entries(data.byStatus).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Orders" value={String(t.orders)} hint={`${t.active} in progress`} />
        <Kpi label="Delivered sales" value={rupees(t.gmvPaise)} hint={`${t.delivered} delivered`} />
        <Kpi label="Average order" value={t.delivered ? rupees(t.averageOrderPaise) : "None yet"} />
        <Kpi
          label="Cancel rate"
          value={`${t.cancelRatePercent}%`}
          hint={`${t.cancelled} cancelled`}
        />
        <Kpi
          label="Average delivery"
          value={t.averageDeliveryMins === null ? "None yet" : `${t.averageDeliveryMins} min`}
          hint="Placed to delivered"
        />
        <Kpi
          label="On time"
          value={t.onTimePercent === null ? "None yet" : `${t.onTimePercent}%`}
          hint="Within the promised time"
        />
      </div>

      <DailyChart daily={data.daily} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="by-status">
          <h2 id="by-status" className="mb-2 text-sm font-extrabold">
            Orders by status
          </h2>
          <TableShell>
            <table className="w-full">
              <tbody>
                {statuses.length === 0 ? (
                  <tr>
                    <td className={`${td} py-8 text-center text-ink-500`}>
                      No orders in this range.
                    </td>
                  </tr>
                ) : (
                  statuses.map(([status, count]) => (
                    <tr key={status} className="border-b border-line last:border-0">
                      <td className={td}>
                        <Badge
                          tone={
                            status === "delivered"
                              ? "green"
                              : status === "cancelled" || status === "payment_failed"
                                ? "red"
                                : "amber"
                          }
                        >
                          {STATUS_LABEL[status] ?? status}
                        </Badge>
                      </td>
                      <td className={`${td} text-right font-bold tabular-nums`}>{count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableShell>
        </section>

        {data.byWarehouse.length > 0 ? (
          <section aria-labelledby="by-wh">
            <h2 id="by-wh" className="mb-2 text-sm font-extrabold">
              By warehouse
            </h2>
            <TableShell>
              <table className="w-full">
                <thead className="border-b border-line">
                  <tr>
                    <th className={th}>Warehouse</th>
                    <th className={`${th} text-right`}>Orders</th>
                    <th className={`${th} text-right`}>Delivered sales</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byWarehouse.map((w) => (
                    <tr key={w.warehouseId} className="border-b border-line last:border-0">
                      <td className={`${td} font-bold`}>{nameOf(w.warehouseId)}</td>
                      <td className={`${td} text-right tabular-nums`}>{w.orders}</td>
                      <td className={`${td} text-right tabular-nums`}>{rupees(w.gmvPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </section>
        ) : null}
      </div>

      <section aria-labelledby="top">
        <h2 id="top" className="mb-2 text-sm font-extrabold">
          Top products by revenue
        </h2>
        <TableShell>
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <th className={th}>Product</th>
                <th className={`${th} text-right`}>Units</th>
                <th className={`${th} text-right`}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.length === 0 ? (
                <tr>
                  <td className={`${td} py-8 text-center text-ink-500`} colSpan={3}>
                    Nothing sold in this range.
                  </td>
                </tr>
              ) : (
                data.topProducts.map((p) => (
                  <tr key={p.productId} className="border-b border-line last:border-0">
                    <td className={`${td} font-bold`}>{p.name}</td>
                    <td className={`${td} text-right tabular-nums`}>{p.quantity}</td>
                    <td className={`${td} text-right tabular-nums`}>{rupees(p.revenuePaise)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      </section>
    </div>
  );
}

/** Bars drawn in plain SVG so there is no chart library to ship. A table sits behind a toggle. */
function DailyChart({ daily }: { daily: OrderSummary["daily"] }) {
  const [metric, setMetric] = useState<"orders" | "gmv">("orders");
  const [table, setTable] = useState(false);
  const value = (d: OrderSummary["daily"][number]) =>
    metric === "orders" ? d.orders : d.gmvPaise / 100;
  const max = Math.max(1, ...daily.map(value));
  const W = 720;
  const H = 200;
  const slot = W / Math.max(1, daily.length);
  const barW = Math.min(48, slot * 0.6);
  // Label every day on short ranges, every few days on long ones
  const step = Math.ceil(daily.length / 8);
  const format = (n: number) => (metric === "orders" ? String(n) : rupees(n * 100));

  return (
    <section aria-labelledby="daily" className="rounded-xl border border-line bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="daily" className="text-sm font-extrabold">
          {metric === "orders" ? "Orders per day" : "Delivered sales per day"}
        </h2>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Chart metric" className="flex gap-1">
            {(["orders", "gmv"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={metric === m}
                onClick={() => setMetric(m)}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  metric === m
                    ? "border-brand-600 bg-brand-100 text-brand-900"
                    : "border-line text-ink-700"
                }`}
              >
                {m === "orders" ? "Orders" : "Sales"}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={table}
            onClick={() => setTable((v) => !v)}
            className="rounded-full border border-line px-3 py-1 text-xs font-bold text-ink-700"
          >
            {table ? "Show chart" : "Show table"}
          </button>
        </div>
      </div>

      {table ? (
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              <th className={th}>Day</th>
              <th className={`${th} text-right`}>Orders</th>
              <th className={`${th} text-right`}>Delivered sales</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.date} className="border-b border-line last:border-0">
                <td className={td}>{shortDate(d.date)}</td>
                <td className={`${td} text-right tabular-nums`}>{d.orders}</td>
                <td className={`${td} text-right tabular-nums`}>{rupees(d.gmvPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H + 28}`}
          role="img"
          aria-label={`${metric === "orders" ? "Orders" : "Delivered sales"} for each day, highest ${format(max)}`}
          className="h-auto w-full"
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={0}
              x2={W}
              y1={H - H * f}
              y2={H - H * f}
              stroke="#dde5e3"
              strokeDasharray="3 4"
            />
          ))}
          {daily.map((d, i) => {
            const v = value(d);
            const h = (v / max) * (H - 20);
            const x = i * slot + (slot - barW) / 2;
            return (
              <g key={d.date}>
                <title>{`${shortDate(d.date)}: ${format(v)}`}</title>
                <rect
                  x={x}
                  y={H - h}
                  width={barW}
                  height={Math.max(h, v > 0 ? 2 : 0)}
                  rx={4}
                  fill="#42c86e"
                />
                {v > 0 ? (
                  <text
                    x={x + barW / 2}
                    y={H - h - 5}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="#3b4a47"
                  >
                    {format(v)}
                  </text>
                ) : null}
                {i % step === 0 ? (
                  <text
                    x={x + barW / 2}
                    y={H + 18}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#6b7a77"
                  >
                    {shortDate(d.date)}
                  </text>
                ) : null}
              </g>
            );
          })}
          <line x1={0} x2={W} y1={H} y2={H} stroke="#dde5e3" />
        </svg>
      )}
    </section>
  );
}
