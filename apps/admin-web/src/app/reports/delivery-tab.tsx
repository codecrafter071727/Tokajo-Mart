"use client";

import type { DeliveryReport } from "@qc/contracts";
import Link from "next/link";
import { useState } from "react";
import { Segmented } from "../../components/kit";
import { useWarehouse } from "../../components/shell/warehouse-context";
import { Card, EmptyState, Stat } from "../../components/ui/core";
import { Ban, CheckCircle2, Clock, PackageCheck, Timer } from "../../components/ui/icons";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/table";
import {
  BarsChart,
  CsvButton,
  NoData,
  ReportError,
  ReportSkeleton,
  StatGrid,
  useReportPair,
} from "./report-ui";
import { change, count, hourLabel, mins, pct, type DayRange } from "./report-utils";

const round = (v: number | null) => (v == null ? "" : Math.round(v));

export function DeliveryTab({ range, warehouseId }: { range: DayRange; warehouseId: string }) {
  const { now, before } = useReportPair<DeliveryReport>("delivery", range, warehouseId);
  const { nameOf } = useWarehouse();
  const [hourly, setHourly] = useState<"orders" | "minutes">("orders");

  if (now.isError) return <ReportError error={now.error} onRetry={() => void now.refetch()} />;
  if (now.isPending) return <ReportSkeleton />;
  const r = now.data;
  const b = before.data?.totals;
  const t = r.totals;
  const placed = r.byHour.reduce((n, h) => n + h.orders, 0);
  if (placed === 0 && t.delivered === 0 && t.cancelled === 0) return <NoData />;
  const tag = `${range.from}-to-${range.to}`;

  return (
    <div className="space-y-6">
      <StatGrid>
        <Stat
          delay={0}
          icon={PackageCheck}
          label="Delivered"
          value={count(t.delivered)}
          {...change(t.delivered, b?.delivered)}
        />
        <Stat
          delay={1}
          icon={Timer}
          label="Average delivery time"
          value={mins(t.averageMins)}
          hint="Placed to delivered"
          {...change(t.averageMins, b?.averageMins, "down")}
        />
        <Stat
          delay={2}
          icon={Clock}
          label="Slowest 10% take"
          value={mins(t.p90Mins)}
          hint="90th percentile, placed to delivered"
          {...change(t.p90Mins, b?.p90Mins, "down")}
        />
        <Stat
          delay={3}
          icon={CheckCircle2}
          label="On time"
          value={pct(t.onTimePercent)}
          hint="Within the time promised at checkout"
          {...change(t.onTimePercent, b?.onTimePercent)}
        />
        <Stat
          delay={4}
          icon={Ban}
          label="Cancelled"
          value={count(t.cancelled)}
          {...change(t.cancelled, b?.cancelled, "down")}
        />
      </StatGrid>

      <Card
        title={hourly === "orders" ? "Orders by hour of day" : "Delivery time by hour of day"}
        description="By the hour the order was placed, India time"
        actions={
          <Segmented
            label="Chart"
            options={[
              { value: "orders", label: "Orders" },
              { value: "minutes", label: "Minutes" },
            ]}
            value={hourly}
            onChange={setHourly}
          />
        }
      >
        <BarsChart
          data={r.byHour.map((h) => ({
            hour: h.hour,
            orders: h.orders,
            minutes: h.averageMins == null ? 0 : Math.round(h.averageMins),
          }))}
          xKey="hour"
          series={[
            hourly === "orders"
              ? { key: "orders", name: "Orders", color: "var(--chart-1)" }
              : { key: "minutes", name: "Average minutes", color: "var(--chart-3)" },
          ]}
          xFormat={(v) => hourLabel(Number(v))}
          yFormat={hourly === "orders" ? (v) => count(v) : (v) => `${v} min`}
          label={
            hourly === "orders"
              ? "Orders placed in each hour of the day"
              : "Average delivery minutes for orders placed in each hour"
          }
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card
          flush
          className="xl:col-span-2"
          title="By warehouse"
          actions={
            <CsvButton
              name={`delivery-by-warehouse-${tag}`}
              headers={[
                "Warehouse",
                "Orders",
                "Delivered",
                "Cancelled",
                "Average minutes",
                "On time %",
              ]}
              rows={r.byWarehouse.map((w) => [
                nameOf(w.warehouseId),
                w.orders,
                w.delivered,
                w.cancelled,
                round(w.averageMins),
                round(w.onTimePercent),
              ])}
            />
          }
        >
          {r.byWarehouse.length === 0 ? (
            <EmptyState title="No warehouse had orders" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Warehouse</Th>
                  <Th align="right">Orders</Th>
                  <Th align="right">Delivered</Th>
                  <Th align="right">Cancelled</Th>
                  <Th align="right">Average</Th>
                  <Th align="right">On time</Th>
                </tr>
              </THead>
              <TBody>
                {r.byWarehouse.map((w) => (
                  <Tr key={w.warehouseId}>
                    <Td>
                      <Link
                        href={`/warehouses/${encodeURIComponent(w.warehouseId)}`}
                        className="font-medium text-ink hover:text-accent hover:underline"
                      >
                        {nameOf(w.warehouseId)}
                      </Link>
                    </Td>
                    <Td align="right">{count(w.orders)}</Td>
                    <Td align="right">{count(w.delivered)}</Td>
                    <Td align="right">{count(w.cancelled)}</Td>
                    <Td align="right">{mins(w.averageMins)}</Td>
                    <Td align="right">{pct(w.onTimePercent)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card
          flush
          title="Why orders were cancelled"
          actions={
            <CsvButton
              name={`cancellations-${tag}`}
              headers={["Reason", "Orders"]}
              rows={r.cancellations.map((c) => [c.reason, c.count])}
            />
          }
        >
          {r.cancellations.length === 0 ? (
            <EmptyState title="No cancellations">Nothing was cancelled in this period.</EmptyState>
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Reason</Th>
                  <Th align="right">Orders</Th>
                </tr>
              </THead>
              <TBody>
                {r.cancellations.map((c) => (
                  <Tr key={c.reason}>
                    <Td className="max-w-[260px] whitespace-normal">{c.reason}</Td>
                    <Td align="right">{count(c.count)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
