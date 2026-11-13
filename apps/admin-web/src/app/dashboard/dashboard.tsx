"use client";

import type { AdminWarehouse, OrderSummary } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "../../components/icons";
import {
  Alert,
  Panel,
  Segmented,
  selectCls,
  td,
  tdNum,
  th,
  thNum,
  Toolbar,
} from "../../components/ui";
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
        <Segmented
          label="Date range"
          options={RANGES.map((r) => ({ value: r.key, label: r.label }))}
          value={range}
          onChange={setRange}
        />
        <select
          aria-label="Warehouse"
          value={warehouseId}
          onChange={(event) => setWarehouseId(event.target.value)}
          className={selectCls}
        >
          <option value="">All warehouses</option>
          {warehouses.data?.items.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-ink-500 tabular-nums">
          {shortDate(from)} to {shortDate(to)}
          {summary.isFetching && !summary.isPending ? " · updating" : ""}
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
    <div className="space-y-6" aria-busy="true" aria-label="Loading the report">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-[118px] animate-pulse rounded-xl border border-line bg-white" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl border border-line bg-white" />
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: IconName;
  tone?: "brand" | "amber" | "red" | "blue";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-700",
  } as const;
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-500">{label}</p>
        <span className={`grid size-8 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

const STATUS_TONE: Record<string, { bar: string; dot: string }> = {
  confirmed: { bar: "bg-blue-500", dot: "bg-blue-500" },
  delivered: { bar: "bg-brand-600", dot: "bg-brand-600" },
  cancelled: { bar: "bg-red-500", dot: "bg-red-500" },
  payment_failed: { bar: "bg-red-500", dot: "bg-red-500" },
  expired: { bar: "bg-ink-300", dot: "bg-ink-300" },
  pending_payment: { bar: "bg-ink-300", dot: "bg-ink-300" },
};
const inProgress = { bar: "bg-amber-500", dot: "bg-amber-500" };

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
        <Kpi
          icon="orders"
          label="Orders"
          value={String(t.orders)}
          hint={`${t.active} in progress`}
        />
        <Kpi
          icon="check"
          label="Delivered sales"
          value={rupees(t.gmvPaise)}
          hint={`${t.delivered} delivered`}
        />
        <Kpi
          icon="catalog"
          label="Average order"
          value={t.delivered ? rupees(t.averageOrderPaise) : "None yet"}
          tone="blue"
        />
        <Kpi
          icon="alert"
          label="Cancel rate"
          value={`${t.cancelRatePercent}%`}
          hint={`${t.cancelled} cancelled`}
          tone={t.cancelRatePercent > 5 ? "red" : "amber"}
        />
        <Kpi
          icon="riders"
          label="Average delivery"
          value={
            t.averageDeliveryMins === null
              ? "None yet"
              : t.averageDeliveryMins < 1
                ? "Under 1 min"
                : `${t.averageDeliveryMins} min`
          }
          hint="Placed to delivered"
          tone="blue"
        />
        <Kpi
          icon="dashboard"
          label="On time"
          value={t.onTimePercent === null ? "None yet" : `${t.onTimePercent}%`}
          hint="Within the promised time"
        />
      </div>

      <DailyChart daily={data.daily} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Orders by status">
          {statuses.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">No orders in this range.</p>
          ) : (
            <ul className="space-y-3">
              {statuses.map(([status, count]) => {
                const tone = STATUS_TONE[status] ?? inProgress;
                const share = t.orders ? Math.round((count / t.orders) * 100) : 0;
                return (
                  <li key={status}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span className={`size-2 rounded-full ${tone.dot}`} aria-hidden="true" />
                        {STATUS_LABEL[status] ?? status}
                      </span>
                      <span className="tabular-nums text-ink-500">
                        <span className="font-semibold text-ink-900">{count}</span> · {share}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                      <div
                        className={`h-full rounded-full ${tone.bar}`}
                        style={{ width: `${Math.max(share, 2)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {data.byWarehouse.length > 0 ? (
          <Panel title="By warehouse" flush>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th className={th}>Warehouse</th>
                    <th className={thNum}>Orders</th>
                    <th className={thNum}>Delivered sales</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byWarehouse.map((w) => (
                    <tr key={w.warehouseId}>
                      <td className={`${td} font-medium`}>{nameOf(w.warehouseId)}</td>
                      <td className={tdNum}>{w.orders}</td>
                      <td className={`${tdNum} font-semibold`}>{rupees(w.gmvPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}
      </div>

      <Panel title="Top products by revenue" flush>
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th className={`${th} w-12`}>#</th>
                <th className={th}>Product</th>
                <th className={thNum}>Units</th>
                <th className={thNum}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.length === 0 ? (
                <tr>
                  <td className={`${td} py-10 text-center text-ink-500`} colSpan={4}>
                    Nothing sold in this range.
                  </td>
                </tr>
              ) : (
                data.topProducts.map((p, i) => (
                  <tr key={p.productId}>
                    <td className={`${td} tabular-nums text-ink-500`}>{i + 1}</td>
                    <td className={`${td} font-medium`}>{p.name}</td>
                    <td className={tdNum}>{p.quantity}</td>
                    <td className={`${tdNum} font-semibold`}>{rupees(p.revenuePaise)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
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
  // Draw at the real pixel width so labels stay 11px however wide the card is
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(960);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setW(Math.max(320, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [table]);
  const H = 220;
  const slot = W / Math.max(1, daily.length);
  const barW = Math.min(48, slot * 0.6);
  // Label every day on short ranges, every few days on long ones
  const step = Math.ceil(daily.length / 8);
  const format = (n: number) => (metric === "orders" ? String(n) : rupees(n * 100));

  return (
    <Panel
      title={metric === "orders" ? "Orders per day" : "Delivered sales per day"}
      actions={
        <div className="flex items-center gap-2">
          <Segmented
            label="Chart metric"
            options={[
              { value: "orders", label: "Orders" },
              { value: "gmv", label: "Sales" },
            ]}
            value={metric}
            onChange={setMetric}
          />
          <Segmented
            label="View"
            options={[
              { value: "chart", label: "Chart" },
              { value: "table", label: "Table" },
            ]}
            value={table ? "table" : "chart"}
            onChange={(v) => setTable(v === "table")}
          />
        </div>
      }
    >
      {table ? (
        <div className="data-table -mx-5 -my-5">
          <table>
            <thead>
              <tr>
                <th className={th}>Day</th>
                <th className={thNum}>Orders</th>
                <th className={thNum}>Delivered sales</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.date}>
                  <td className={td}>{shortDate(d.date)}</td>
                  <td className={tdNum}>{d.orders}</td>
                  <td className={tdNum}>{rupees(d.gmvPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={box}>
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
                stroke="#e3e9e7"
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
            <line x1={0} x2={W} y1={H} y2={H} stroke="#cfd9d6" />
          </svg>
        </div>
      )}
    </Panel>
  );
}
