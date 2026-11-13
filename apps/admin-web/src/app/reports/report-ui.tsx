"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, Callout, Card, EmptyState } from "../../components/ui/core";
import { ArrowDown, Inbox, RefreshCw } from "../../components/ui/icons";
import { Skeleton } from "../../components/ui/skeleton";
import { errorMessage, gw, qs } from "../../lib/gw";
import { downloadCsv, previousRange, type DayRange } from "./report-utils";

export type ReportName =
  "sales" | "products" | "delivery" | "riders" | "customers" | "hourly-heatmap";

/** One analytics report for a range, cached per range and warehouse. */
export function useReport<T>(name: ReportName, range: DayRange, warehouseId: string) {
  return useQuery({
    queryKey: ["analytics", name, range.from, range.to, warehouseId],
    staleTime: 60_000,
    queryFn: () =>
      gw<T>(
        "GET",
        `/v1/analytics/${name}${qs({ ...range, warehouseId: warehouseId || undefined })}`,
      ),
  });
}

/** The same report for the range and for the equal period just before it. */
export function useReportPair<T>(name: ReportName, range: DayRange, warehouseId: string) {
  const now = useReport<T>(name, range, warehouseId);
  const before = useReport<T>(name, previousRange(range), warehouseId);
  return { now, before };
}

export function ReportError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <Callout tone="bad" title="Could not load this report">
        {errorMessage(error)}
      </Callout>
      <Button icon={RefreshCw} onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function NoData({ children }: { children?: ReactNode }) {
  return (
    <Card>
      <EmptyState icon={<Inbox className="size-5" />} title="Nothing in this period">
        {children ??
          "No orders were placed in these dates. Pick a longer range or another warehouse."}
      </EmptyState>
    </Card>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export function ReportSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading the report</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-8 w-24" />
            <Skeleton className="mt-3 h-3 w-36" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-line bg-surface p-5" aria-hidden>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-5 h-[240px] w-full" />
      </div>
    </div>
  );
}

/** Saves the table under it as a CSV file. */
export function CsvButton({
  name,
  headers,
  rows,
}: {
  name: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={ArrowDown}
      disabled={rows.length === 0}
      onClick={() => downloadCsv(name, headers, rows)}
    >
      CSV
    </Button>
  );
}

const TICK = { fill: "var(--muted)", fontSize: 12 };
const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  color: "var(--ink)",
  fontSize: 13,
  boxShadow: "var(--shadow-pop)",
};

/** Fades a chart in after mount, so the server render and the first client render always match. */
function useReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 120);
    return () => clearTimeout(t);
  }, []);
  return ready;
}

export type BarSeries = { key: string; name: string; color: string };

/** Bars per category (a day or an hour), one or more series, optionally stacked. */
export function BarsChart<T extends Record<string, string | number>>({
  data,
  xKey,
  series,
  label,
  stacked,
  xFormat = (v) => String(v),
  yFormat = (v) => String(v),
  height = 260,
}: {
  data: T[];
  xKey: keyof T & string;
  series: BarSeries[];
  label: string;
  stacked?: boolean;
  xFormat?: (value: string | number) => string;
  yFormat?: (value: number) => string;
  height?: number;
}) {
  const ready = useReady();
  return (
    <div
      className={`transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
      style={{ height }}
      role="img"
      aria-label={label}
    >
      {ready ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey={xKey as string}
              tickFormatter={xFormat}
              axisLine={false}
              tickLine={false}
              tick={TICK}
              dy={8}
              minTickGap={16}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={TICK}
              width={56}
              tickFormatter={(v: number) => yFormat(v)}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(v) => xFormat(v as string | number)}
              formatter={(v, n) => [yFormat(Number(v)), String(n)]}
            />
            {series.length > 1 ? (
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: "var(--muted)", paddingTop: 8 }}
              />
            ) : null}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color}
                stackId={stacked ? "a" : undefined}
                radius={stacked && i < series.length - 1 ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                maxBarSize={28}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

/** A labelled horizontal bar: a share of a whole, for categories and payment methods. */
export function ShareBar({
  label,
  value,
  share,
  detail,
}: {
  label: string;
  value: string;
  share: number;
  detail?: string;
}) {
  const width = Math.max(0, Math.min(100, share));
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="truncate font-medium text-ink">{label}</span>
        <span className="tnum shrink-0 text-muted">
          {value}
          {detail ? <span className="ml-2 text-faint">{detail}</span> : null}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line"
        role="img"
        aria-label={`${label}: ${Math.round(width)}%`}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
