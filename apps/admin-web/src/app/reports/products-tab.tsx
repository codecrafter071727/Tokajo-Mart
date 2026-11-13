"use client";

import type { ProductsReport } from "@qc/contracts";
import Link from "next/link";
import { useWarehouse } from "../../components/shell/warehouse-context";
import { Card, EmptyState, Stat } from "../../components/ui/core";
import { Boxes, IndianRupee, Package } from "../../components/ui/icons";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/table";
import { rupees } from "../../lib/api";
import {
  CsvButton,
  NoData,
  ReportError,
  ReportSkeleton,
  ShareBar,
  StatGrid,
  useReportPair,
} from "./report-ui";
import { change, count, csvRupees, type DayRange } from "./report-utils";

type Line = ProductsReport["top"][number];

function ProductTable({
  title,
  description,
  lines,
  file,
}: {
  title: string;
  description: string;
  lines: Line[];
  file: string;
}) {
  return (
    <Card
      flush
      title={title}
      description={description}
      actions={
        <CsvButton
          name={file}
          headers={["Product id", "Product", "Units", "Revenue (Rs)"]}
          rows={lines.map((l) => [l.productId, l.name, l.units, csvRupees(l.revenuePaise)])}
        />
      }
    >
      {lines.length === 0 ? (
        <EmptyState title="No products to show" />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Product</Th>
              <Th align="right">Units</Th>
              <Th align="right">Revenue</Th>
            </tr>
          </THead>
          <TBody>
            {lines.map((l) => (
              <Tr key={l.productId}>
                <Td>
                  <Link
                    href={`/catalog/products/${encodeURIComponent(l.productId)}`}
                    className="font-medium text-ink hover:text-accent hover:underline"
                  >
                    {l.name}
                  </Link>
                </Td>
                <Td align="right">{count(l.units)}</Td>
                <Td align="right">{rupees(l.revenuePaise)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

export function ProductsTab({ range, warehouseId }: { range: DayRange; warehouseId: string }) {
  const { now, before } = useReportPair<ProductsReport>("products", range, warehouseId);
  const { nameOf } = useWarehouse();

  if (now.isError) return <ReportError error={now.error} onRetry={() => void now.refetch()} />;
  if (now.isPending) return <ReportSkeleton />;
  const r = now.data;
  const b = before.data?.totals;
  if (r.totals.units === 0) return <NoData />;
  const tag = `${range.from}-to-${range.to}`;

  return (
    <div className="space-y-6">
      <StatGrid>
        <Stat
          delay={0}
          icon={IndianRupee}
          label="Product revenue"
          value={rupees(r.totals.revenuePaise)}
          hint="Items on orders that were not cancelled"
          {...change(r.totals.revenuePaise, b?.revenuePaise)}
        />
        <Stat
          delay={1}
          icon={Boxes}
          label="Units sold"
          value={count(r.totals.units)}
          {...change(r.totals.units, b?.units)}
        />
        <Stat
          delay={2}
          icon={Package}
          label="Products that sold"
          value={count(r.totals.productsSold)}
          hint="Sold at least once"
          {...change(r.totals.productsSold, b?.productsSold)}
        />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProductTable
          title="Best sellers"
          description="Top ten by revenue"
          lines={r.top}
          file={`best-sellers-${tag}`}
        />
        <ProductTable
          title="Slowest sellers"
          description="The ten weakest among products that sold at least once"
          lines={r.bottom}
          file={`slowest-sellers-${tag}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Revenue by category"
          actions={
            <CsvButton
              name={`categories-${tag}`}
              headers={["Category", "Units", "Revenue (Rs)", "Share %"]}
              rows={r.categories.map((c) => [
                c.name,
                c.units,
                csvRupees(c.revenuePaise),
                c.sharePercent.toFixed(1),
              ])}
            />
          }
        >
          <div className="space-y-4">
            {r.categories.map((c) => (
              <ShareBar
                key={c.categoryId ?? c.name}
                label={c.name}
                value={rupees(c.revenuePaise)}
                detail={`${c.sharePercent.toFixed(1)}%`}
                share={c.sharePercent}
              />
            ))}
          </div>
        </Card>

        <Card
          flush
          title="Days out of stock"
          description="Days a product ended with nothing on hand, rebuilt from the stock history"
          actions={
            <CsvButton
              name={`out-of-stock-days-${tag}`}
              headers={["Product id", "Product", "Warehouse", "Days"]}
              rows={r.outOfStockDays.map((o) => [
                o.productId,
                o.name,
                nameOf(o.warehouseId),
                o.days,
              ])}
            />
          }
        >
          {r.outOfStockDays.length === 0 ? (
            <EmptyState title="Nothing ran out">
              No product ended a day with zero stock in this period.
            </EmptyState>
          ) : (
            <Table maxHeight="380px">
              <THead>
                <tr>
                  <Th>Product</Th>
                  <Th>Warehouse</Th>
                  <Th align="right">Days</Th>
                </tr>
              </THead>
              <TBody>
                {r.outOfStockDays.map((o) => (
                  <Tr key={`${o.productId}-${o.warehouseId}`}>
                    <Td>
                      <Link
                        href={`/catalog/products/${encodeURIComponent(o.productId)}`}
                        className="font-medium text-ink hover:text-accent hover:underline"
                      >
                        {o.name}
                      </Link>
                    </Td>
                    <Td muted>{nameOf(o.warehouseId)}</Td>
                    <Td align="right">
                      <span className={o.days >= 3 ? "font-semibold text-bad" : undefined}>
                        {o.days}
                      </span>
                    </Td>
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
