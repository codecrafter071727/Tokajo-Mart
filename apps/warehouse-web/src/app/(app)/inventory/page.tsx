"use client";

import { useQuery } from "@tanstack/react-query";
import type { AvailabilityItem, Product } from "@qc/contracts";
import { Badge, ErrorBanner, PageHeader, th, td } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useWarehouse } from "../../../lib/providers";

const TONE = { in_stock: "green", low: "amber", out: "red" } as const;
const LABEL = { in_stock: "In stock", low: "Low", out: "Out of stock" } as const;

export default function InventoryPage() {
  const { warehouseId } = useWarehouse();
  const { data, error } = useQuery({
    queryKey: ["inventory", warehouseId],
    queryFn: async () => {
      const { items: products } = await api<{ items: Product[] }>("/v1/catalog/products?limit=100");
      const ids = products.map((p) => p.id).join(",");
      const { items } = await api<{ items: AvailabilityItem[] }>(
        `/v1/inventory/availability?warehouseId=${encodeURIComponent(warehouseId)}&productIds=${encodeURIComponent(ids)}`,
      );
      const byId = new Map(items.map((i) => [i.productId, i]));
      return products.map((p) => ({ product: p, stock: byId.get(p.id) }));
    },
    refetchInterval: 15000,
  });
  const order = { out: 0, low: 1, in_stock: 2 } as const;
  const rows = [...(data ?? [])].sort(
    (a, b) => order[a.stock?.status ?? "in_stock"] - order[b.stock?.status ?? "in_stock"],
  );

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Stock status at this warehouse. Exact counts show only when stock is low."
      />
      {error ? <ErrorBanner>{error.message}</ErrorBanner> : null}
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              <th className={th}>Product</th>
              <th className={th}>Pack</th>
              <th className={th}>Status</th>
              <th className={th}>Left</th>
              <th className={th}>Max per order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ product, stock }) => (
              <tr key={product.id}>
                <td className={`${td} font-semibold`}>
                  <span className="mr-2">{product.emoji}</span>
                  {product.name}
                </td>
                <td className={td}>{product.unit}</td>
                <td className={td}>
                  {stock ? (
                    <Badge tone={TONE[stock.status]}>{LABEL[stock.status]}</Badge>
                  ) : (
                    "Unknown"
                  )}
                </td>
                <td className={`${td} tabular-nums`}>{stock?.remaining ?? "-"}</td>
                <td className={`${td} tabular-nums`}>{stock?.maxPerOrder ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
