"use client";

import type { CustomersReport } from "@qc/contracts";
import { Card, EmptyState, Stat } from "../../components/ui/core";
import { RotateCcw, UserCog, Users } from "../../components/ui/icons";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/table";
import { shortDate } from "../../lib/dates";
import {
  BarsChart,
  CsvButton,
  NoData,
  ReportError,
  ReportSkeleton,
  StatGrid,
  useReportPair,
} from "./report-ui";
import { change, count, pct, type DayRange } from "./report-utils";

const WEEKS = 8;

/** Shade a retention cell: stronger green for a larger share of the cohort coming back. */
function cellStyle(value: number | null) {
  if (value == null) return undefined;
  const strength = Math.round(Math.min(100, Math.max(0, value)) * 0.7) + 6;
  return { background: `color-mix(in oklch, var(--accent) ${strength}%, transparent)` };
}

export function CustomersTab({ range, warehouseId }: { range: DayRange; warehouseId: string }) {
  const { now, before } = useReportPair<CustomersReport>("customers", range, warehouseId);

  if (now.isError) return <ReportError error={now.error} onRetry={() => void now.refetch()} />;
  if (now.isPending) return <ReportSkeleton />;
  const r = now.data;
  const b = before.data?.totals;
  const t = r.totals;
  const signupsKnown = r.daily.some((d) => d.signups !== null);
  if (t.active === 0 && !r.daily.some((d) => (d.signups ?? 0) > 0)) return <NoData />;
  const tag = `${range.from}-to-${range.to}`;

  return (
    <div className="space-y-6">
      <StatGrid>
        <Stat
          delay={0}
          icon={Users}
          label="Customers who ordered"
          value={count(t.active)}
          hint="At least one order in this period"
          {...change(t.active, b?.active)}
        />
        <Stat
          delay={1}
          icon={UserCog}
          label="New customers"
          value={count(t.newCustomers)}
          hint="First ever order in this period"
          {...change(t.newCustomers, b?.newCustomers)}
        />
        <Stat
          delay={2}
          icon={RotateCcw}
          label="Repeat rate"
          value={pct(t.repeatRatePercent)}
          hint="Ordered two or more times in this period"
          {...change(t.repeatRatePercent, b?.repeatRatePercent)}
        />
      </StatGrid>

      <Card
        title="New customers per day"
        description={
          signupsKnown
            ? "First orders against new accounts created"
            : "First orders. Sign ups have no warehouse, so they show for all warehouses only."
        }
        actions={
          <CsvButton
            name={`new-customers-${tag}`}
            headers={["Date", "New customers", "Sign ups"]}
            rows={r.daily.map((d) => [d.date, d.newCustomers, d.signups])}
          />
        }
      >
        <BarsChart
          data={r.daily.map((d) => ({
            date: d.date,
            newCustomers: d.newCustomers,
            signups: d.signups ?? 0,
          }))}
          xKey="date"
          series={[
            { key: "newCustomers", name: "First orders", color: "var(--chart-2)" },
            ...(signupsKnown
              ? [{ key: "signups", name: "Sign ups", color: "var(--chart-1)" }]
              : []),
          ]}
          xFormat={(v) => shortDate(String(v))}
          label="New customers per day"
        />
      </Card>

      <Card
        flush
        title="Retention by first order week"
        description="Share of each week's new customers who ordered again in later weeks"
        actions={
          <CsvButton
            name={`retention-${tag}`}
            headers={[
              "First order week",
              "Customers",
              ...Array.from({ length: WEEKS }, (_, i) => `Week ${i} %`),
            ]}
            rows={r.cohorts.map((c) => [
              c.week,
              c.size,
              ...Array.from({ length: WEEKS }, (_, i) => {
                const v = c.retention[i];
                return v == null ? "" : v.toFixed(1);
              }),
            ])}
          />
        }
      >
        {r.cohorts.length === 0 ? (
          <EmptyState title="No cohorts yet">
            Retention needs at least one week of first orders in the range.
          </EmptyState>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>First order week</Th>
                <Th align="right">Customers</Th>
                {Array.from({ length: WEEKS }, (_, i) => (
                  <Th key={i} align="center">
                    {i === 0 ? "Week 0" : `+${i}`}
                  </Th>
                ))}
              </tr>
            </THead>
            <TBody>
              {r.cohorts.map((c) => (
                <Tr key={c.week}>
                  <Td>Week of {shortDate(c.week)}</Td>
                  <Td align="right">{count(c.size)}</Td>
                  {Array.from({ length: WEEKS }, (_, i) => {
                    const v = c.retention[i];
                    return (
                      <Td key={i} align="center" className="px-1.5">
                        {v == null ? (
                          <span className="text-faint" aria-label="Not reached yet">
                            .
                          </span>
                        ) : (
                          <span
                            className="tnum inline-block min-w-[3.25rem] rounded-md px-1.5 py-1 text-xs font-medium"
                            style={cellStyle(v)}
                          >
                            {Math.round(v)}%
                          </span>
                        )}
                      </Td>
                    );
                  })}
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
