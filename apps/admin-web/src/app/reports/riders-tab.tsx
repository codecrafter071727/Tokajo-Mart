"use client";

import type { RidersReport } from "@qc/contracts";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "../../components/ui/brand";
import { Card, Stat } from "../../components/ui/core";
import { ArrowDown, ArrowUp, Bike, IndianRupee, Timer } from "../../components/ui/icons";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/table";
import { rupees } from "../../lib/api";
import {
  CsvButton,
  NoData,
  ReportError,
  ReportSkeleton,
  StatGrid,
  useReportPair,
} from "./report-ui";
import { change, count, csvRupees, mins, type DayRange } from "./report-utils";

type Rider = RidersReport["riders"][number];
type SortKey = "deliveries" | "earningsPaise" | "averageMins" | "distanceKm";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "deliveries", label: "Deliveries" },
  { key: "earningsPaise", label: "Earnings" },
  { key: "distanceKm", label: "Distance" },
  { key: "averageMins", label: "Average time" },
];

function totals(riders: Rider[]) {
  const deliveries = riders.reduce((n, r) => n + r.deliveries, 0);
  const earnings = riders.reduce((n, r) => n + r.earningsPaise, 0);
  // Weighted by deliveries, so a rider with one slow trip does not swing the average
  const timed = riders.filter((r) => r.averageMins != null && r.deliveries > 0);
  const weight = timed.reduce((n, r) => n + r.deliveries, 0);
  const average = weight
    ? timed.reduce((n, r) => n + (r.averageMins as number) * r.deliveries, 0) / weight
    : null;
  return { deliveries, earnings, average, active: riders.filter((r) => r.deliveries > 0).length };
}

export function RidersTab({ range, warehouseId }: { range: DayRange; warehouseId: string }) {
  const { now, before } = useReportPair<RidersReport>("riders", range, warehouseId);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "deliveries",
    desc: true,
  });

  const sorted = useMemo(() => {
    const rows = [...(now.data?.riders ?? [])];
    rows.sort((a, b) => {
      // Riders with no average go last whichever way the column is sorted
      const x = a[sort.key] ?? (sort.desc ? -Infinity : Infinity);
      const y = b[sort.key] ?? (sort.desc ? -Infinity : Infinity);
      return sort.desc ? Number(y) - Number(x) : Number(x) - Number(y);
    });
    return rows;
  }, [now.data, sort]);

  if (now.isError) return <ReportError error={now.error} onRetry={() => void now.refetch()} />;
  if (now.isPending) return <ReportSkeleton />;
  const t = totals(now.data.riders);
  const b = before.data ? totals(before.data.riders) : undefined;
  if (t.deliveries === 0) return <NoData>No deliveries were completed in these dates.</NoData>;

  return (
    <div className="space-y-6">
      <StatGrid>
        <Stat
          delay={0}
          icon={Bike}
          label="Deliveries"
          value={count(t.deliveries)}
          hint={`${t.active} riders delivered`}
          {...change(t.deliveries, b?.deliveries)}
        />
        <Stat
          delay={1}
          icon={IndianRupee}
          label="Rider earnings"
          value={rupees(t.earnings)}
          hint="Payout plus tips"
          {...change(t.earnings, b?.earnings)}
        />
        <Stat
          delay={2}
          icon={Timer}
          label="Average delivery time"
          value={mins(t.average)}
          hint="Weighted by deliveries"
          {...change(t.average, b?.average, "down")}
        />
      </StatGrid>

      <Card
        flush
        title="Riders"
        description="Select a column to sort"
        actions={
          <CsvButton
            name={`riders-${range.from}-to-${range.to}`}
            headers={[
              "Rider id",
              "Rider",
              "Deliveries",
              "Earnings (Rs)",
              "Tips (Rs)",
              "Distance km",
              "Average minutes",
            ]}
            rows={sorted.map((r) => [
              r.riderId,
              r.name,
              r.deliveries,
              csvRupees(r.earningsPaise),
              csvRupees(r.tipsPaise),
              r.distanceKm.toFixed(1),
              r.averageMins == null ? "" : Math.round(r.averageMins),
            ])}
          />
        }
      >
        <Table maxHeight="560px">
          <THead>
            <tr>
              <Th>Rider</Th>
              {COLUMNS.map((c) => {
                const on = sort.key === c.key;
                return (
                  <Th key={c.key} align="right">
                    <button
                      type="button"
                      onClick={() =>
                        setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : true }))
                      }
                      aria-label={`Sort by ${c.label}`}
                      className={`inline-flex items-center gap-1 ${on ? "text-ink" : "hover:text-ink"}`}
                    >
                      {c.label}
                      {on ? (
                        sort.desc ? (
                          <ArrowDown className="size-3" aria-hidden />
                        ) : (
                          <ArrowUp className="size-3" aria-hidden />
                        )
                      ) : null}
                    </button>
                  </Th>
                );
              })}
              <Th align="right">Tips</Th>
            </tr>
          </THead>
          <TBody>
            {sorted.map((r) => (
              <Tr key={r.riderId}>
                <Td>
                  <Link
                    href={`/riders/${encodeURIComponent(r.riderId)}`}
                    className="flex items-center gap-2.5 font-medium text-ink hover:text-accent"
                  >
                    <Avatar name={r.name} size={28} />
                    <span className="hover:underline">{r.name}</span>
                  </Link>
                </Td>
                <Td align="right">{count(r.deliveries)}</Td>
                <Td align="right">{rupees(r.earningsPaise)}</Td>
                <Td align="right">{r.distanceKm.toFixed(1)} km</Td>
                <Td align="right">{mins(r.averageMins)}</Td>
                <Td align="right" muted>
                  {rupees(r.tipsPaise)}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
