"use client";

import type { SalesReport } from "@qc/contracts";
import { useState } from "react";
import { Segmented } from "../../components/kit";
import { TrendChart } from "../../components/ui/charts";
import { Card, Stat } from "../../components/ui/core";
import {
  IndianRupee,
  Percent,
  Receipt,
  ShoppingBag,
  Users,
  UserCog,
} from "../../components/ui/icons";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/table";
import { rupees } from "../../lib/api";
import { shortDate } from "../../lib/dates";
import {
  BarsChart,
  CsvButton,
  NoData,
  ReportError,
  ReportSkeleton,
  ShareBar,
  StatGrid,
  useReportPair,
} from "./report-ui";
import { change, count, csvRupees, type DayRange } from "./report-utils";

const METHOD_LABEL: Record<string, string> = { cod: "Cash on delivery", online: "Online" };

export function SalesTab({ range, warehouseId }: { range: DayRange; warehouseId: string }) {
  const { now, before } = useReportPair<SalesReport>("sales", range, warehouseId);
  const [metric, setMetric] = useState<"gmv" | "orders">("gmv");

  if (now.isError) return <ReportError error={now.error} onRetry={() => void now.refetch()} />;
  if (now.isPending) return <ReportSkeleton />;
  const r = now.data;
  const b = before.data?.totals;
  const t = r.totals;
  if (t.orders === 0) return <NoData />;

  const methodTotal = r.byPaymentMethod.reduce((n, m) => n + m.gmvPaise, 0);
  return (
    <div className="space-y-6">
      <StatGrid>
        <Stat
          delay={0}
          icon={IndianRupee}
          label="Sales (delivered)"
          value={rupees(t.gmvPaise)}
          hint={`${count(t.delivered)} delivered orders`}
          {...change(t.gmvPaise, b?.gmvPaise)}
        />
        <Stat
          delay={1}
          icon={ShoppingBag}
          label="Orders placed"
          value={count(t.orders)}
          hint={`${count(t.cancelled)} cancelled`}
          {...change(t.orders, b?.orders)}
        />
        <Stat
          delay={2}
          icon={Receipt}
          label="Average order"
          value={t.averageOrderPaise == null ? "No data" : rupees(Math.round(t.averageOrderPaise))}
          hint="Delivered orders"
          {...change(t.averageOrderPaise, b?.averageOrderPaise)}
        />
        <Stat
          delay={3}
          icon={Percent}
          label="Coupon discounts"
          value={rupees(t.discountPaise)}
          hint="On orders that were not cancelled"
          {...change(t.discountPaise, b?.discountPaise, "down")}
        />
        <Stat
          delay={4}
          icon={Users}
          label="New customers"
          value={count(t.newCustomers)}
          hint="First ever order in this period"
          {...change(t.newCustomers, b?.newCustomers)}
        />
        <Stat
          delay={5}
          icon={UserCog}
          label="Returning customers"
          value={count(t.returningCustomers)}
          hint="Had ordered before this period"
          {...change(t.returningCustomers, b?.returningCustomers)}
        />
      </StatGrid>

      <Card
        title={metric === "gmv" ? "Sales per day" : "Orders per day"}
        description="Sales count delivered orders only. Days are India local days."
        actions={
          <Segmented
            label="Chart"
            options={[
              { value: "gmv", label: "Sales" },
              { value: "orders", label: "Orders" },
            ]}
            value={metric}
            onChange={setMetric}
          />
        }
      >
        <TrendChart
          name={metric === "gmv" ? "Sales" : "Orders"}
          data={r.daily.map((d) => ({
            date: d.date,
            value: metric === "gmv" ? d.gmvPaise : d.orders,
          }))}
          format={metric === "gmv" ? (v) => rupees(v) : (v) => count(v)}
          color={metric === "gmv" ? "var(--chart-2)" : "var(--chart-1)"}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="New and repeat orders"
          description="Orders from first time customers against customers who came back"
        >
          <BarsChart
            data={r.daily.map((d) => ({
              date: d.date,
              newOrders: d.newCustomerOrders,
              repeatOrders: d.repeatCustomerOrders,
            }))}
            xKey="date"
            stacked
            series={[
              { key: "repeatOrders", name: "Repeat", color: "var(--chart-2)" },
              { key: "newOrders", name: "New", color: "var(--chart-1)" },
            ]}
            xFormat={(v) => shortDate(String(v))}
            label="New and repeat customer orders per day"
          />
        </Card>
        <Card title="By payment method" description="Delivered sales">
          <div className="space-y-4">
            {r.byPaymentMethod.map((m) => (
              <ShareBar
                key={m.method}
                label={METHOD_LABEL[m.method] ?? m.method}
                value={rupees(m.gmvPaise)}
                detail={`${count(m.orders)} orders`}
                share={methodTotal ? (m.gmvPaise / methodTotal) * 100 : 0}
              />
            ))}
          </div>
        </Card>
      </div>

      <Card
        flush
        title="Day by day"
        actions={
          <CsvButton
            name={`sales-${range.from}-to-${range.to}`}
            headers={[
              "Date",
              "Orders",
              "Delivered",
              "Sales (Rs)",
              "Discount (Rs)",
              "New customer orders",
              "Repeat customer orders",
            ]}
            rows={r.daily.map((d) => [
              d.date,
              d.orders,
              d.delivered,
              csvRupees(d.gmvPaise),
              csvRupees(d.discountPaise),
              d.newCustomerOrders,
              d.repeatCustomerOrders,
            ])}
          />
        }
      >
        <Table maxHeight="420px">
          <THead>
            <tr>
              <Th>Date</Th>
              <Th align="right">Orders</Th>
              <Th align="right">Delivered</Th>
              <Th align="right">Sales</Th>
              <Th align="right">Discount</Th>
              <Th align="right">New</Th>
              <Th align="right">Repeat</Th>
            </tr>
          </THead>
          <TBody>
            {[...r.daily].reverse().map((d) => (
              <Tr key={d.date}>
                <Td>{shortDate(d.date)}</Td>
                <Td align="right">{count(d.orders)}</Td>
                <Td align="right">{count(d.delivered)}</Td>
                <Td align="right">{rupees(d.gmvPaise)}</Td>
                <Td align="right" muted>
                  {rupees(d.discountPaise)}
                </Td>
                <Td align="right">{count(d.newCustomerOrders)}</Td>
                <Td align="right">{count(d.repeatCustomerOrders)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
