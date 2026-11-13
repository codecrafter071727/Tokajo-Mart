"use client";

import type { HeatmapReport } from "@qc/contracts";
import { useState } from "react";
import { Segmented } from "../../components/kit";
import { Card } from "../../components/ui/core";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/table";
import { CsvButton, NoData, ReportError, ReportSkeleton, useReport } from "./report-ui";
import { count, hourLabel, WEEKDAYS, type DayRange } from "./report-utils";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

const shade = (orders: number, max: number) => {
  if (!orders || !max) return "var(--surface-2)";
  const strength = Math.round((orders / max) * 85) + 12;
  return `color-mix(in oklch, var(--accent) ${strength}%, var(--surface-2))`;
};

export function HeatmapTab({ range, warehouseId }: { range: DayRange; warehouseId: string }) {
  const report = useReport<HeatmapReport>("hourly-heatmap", range, warehouseId);
  const [view, setView] = useState<"grid" | "table">("grid");

  if (report.isError)
    return <ReportError error={report.error} onRetry={() => void report.refetch()} />;
  if (report.isPending) return <ReportSkeleton />;
  const r = report.data;
  if (r.max === 0) return <NoData />;

  const grid = new Map(r.cells.map((c) => [`${c.weekday}-${c.hour}`, c.orders]));
  const at = (weekday: number, hour: number) => grid.get(`${weekday}-${hour}`) ?? 0;
  const busiest = [...r.cells].sort((a, b) => b.orders - a.orders)[0];
  const total = r.cells.reduce((n, c) => n + c.orders, 0);

  return (
    <Card
      title="When customers order"
      description={
        busiest
          ? `${count(total)} orders. Busiest slot: ${WEEKDAYS[busiest.weekday - 1]} ${hourLabel(busiest.hour)} with ${count(busiest.orders)}. India time.`
          : "India time"
      }
      actions={
        <>
          <Segmented
            label="View"
            options={[
              { value: "grid", label: "Heatmap" },
              { value: "table", label: "Table" },
            ]}
            value={view}
            onChange={setView}
          />
          <CsvButton
            name={`order-heatmap-${range.from}-to-${range.to}`}
            headers={["Weekday", ...HOURS.map((h) => hourLabel(h))]}
            rows={WEEKDAYS.map((d, i) => [d, ...HOURS.map((h) => at(i + 1, h))])}
          />
        </>
      }
    >
      {view === "grid" ? (
        <div>
          <div className="overflow-x-auto pb-2">
            <div
              className="grid min-w-[760px] gap-1"
              style={{ gridTemplateColumns: "44px repeat(24, minmax(0, 1fr))" }}
              role="img"
              aria-label={`Orders by weekday and hour. ${count(total)} in total; the table view lists every value.`}
            >
              <span />
              {HOURS.map((h) => (
                <span key={h} className="text-center text-[11px] text-faint">
                  {h % 3 === 0 ? hourLabel(h) : ""}
                </span>
              ))}
              {WEEKDAYS.map((day, i) => (
                <div key={day} className="contents">
                  <span className="flex items-center text-xs font-medium text-muted">{day}</span>
                  {HOURS.map((h) => {
                    const orders = at(i + 1, h);
                    return (
                      <span
                        key={h}
                        title={`${day} ${hourLabel(h)}: ${count(orders)} orders`}
                        className="aspect-square rounded-[5px] ring-1 ring-inset ring-line/60 transition-transform hover:scale-110"
                        style={{ background: shade(orders, r.max) }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted">
            <span>Fewer</span>
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <span
                key={f}
                className="size-4 rounded-[4px] ring-1 ring-inset ring-line/60"
                style={{ background: shade(Math.round(f * r.max), r.max) }}
                aria-hidden
              />
            ))}
            <span>More (up to {count(r.max)} in one hour)</span>
          </div>
        </div>
      ) : (
        <Table maxHeight="520px">
          <THead>
            <tr>
              <Th>Hour</Th>
              {WEEKDAYS.map((d) => (
                <Th key={d} align="right">
                  {d}
                </Th>
              ))}
            </tr>
          </THead>
          <TBody>
            {HOURS.map((h) => (
              <Tr key={h}>
                <Td>{hourLabel(h)}</Td>
                {WEEKDAYS.map((d, i) => (
                  <Td key={d} align="right" muted={at(i + 1, h) === 0}>
                    {count(at(i + 1, h))}
                  </Td>
                ))}
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
