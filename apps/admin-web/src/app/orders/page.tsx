import type { AdminOrder, OrderStatus } from "@qc/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AutoRefresh } from "../../components/auto-refresh";
import { WAREHOUSE_COOKIE } from "../../lib/warehouse-cookie";
import { Badge, Callout, Card, EmptyState } from "../../components/ui/core";
import { SearchFilter } from "../../components/ui/filter-menu";
import { ShoppingBag } from "../../components/ui/icons";
import { PageHeader, Segmented } from "../../components/ui/layout";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/table";
import { rupees } from "../../lib/api";
import { ORDER_STATUS } from "../../lib/order-status";
import { ACCESS_COOKIE, GATEWAY_URL } from "../../lib/session";

// A live view of what is being placed and packed, so never cached
export const dynamic = "force-dynamic";
export const metadata = { title: "Live orders" };

const FILTERS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "New" },
  { value: "packing", label: "Packing" },
  { value: "packed", label: "Packed" },
  { value: "out_for_delivery", label: "On the way" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];
const ACTIVE = new Set(["confirmed", "packing", "packed", "picked_up", "out_for_delivery"]);

const href = (status: string, q: string | undefined) => {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (q) params.set("q", q);
  return params.size > 0 ? `/orders?${params}` : "/orders";
};

const time = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

async function gateway<T>(path: string): Promise<T | "expired" | "failed"> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  try {
    const res = await fetch(`${GATEWAY_URL}${path}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 401) return "expired";
    if (!res.ok) return "failed";
    return (await res.json()) as T;
  } catch {
    return "failed";
  }
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const warehouseId = decodeURIComponent((await cookies()).get(WAREHOUSE_COOKIE)?.value ?? "");
  const params = new URLSearchParams({ limit: "200" });
  if (status && status in ORDER_STATUS) params.set("status", status);
  if (warehouseId) params.set("warehouseId", warehouseId);

  const [result, warehouses] = await Promise.all([
    gateway<{ items: AdminOrder[] }>(`/v1/orders/admin?${params}`),
    gateway<{ items: { id: string; name: string }[] }>("/v1/inventory/warehouses"),
  ]);
  if (result === "expired") redirect("/session/refresh?next=/orders");
  const names = new Map(
    (typeof warehouses === "object" ? warehouses.items : []).map((w) => [w.id, w.name]),
  );

  const needle = q?.trim().toLowerCase();
  const orders =
    result === "failed"
      ? []
      : result.items.filter(
          (o) =>
            !needle ||
            o.number.toLowerCase().includes(needle) ||
            (o.customerName ?? "").toLowerCase().includes(needle),
        );
  const now = Date.now();
  const active = orders.filter((o) => ACTIVE.has(o.status)).length;
  const late = orders.filter(
    (o) => ACTIVE.has(o.status) && (now - Date.parse(o.placedAt)) / 60_000 > o.promisedMins,
  ).length;

  return (
    <>
      <AutoRefresh seconds={20} />
      <PageHeader
        title="Live orders"
        description={
          result === "failed"
            ? "Everything placed, newest first."
            : `${orders.length} ${orders.length === 1 ? "order" : "orders"}${
                warehouseId ? ` at ${names.get(warehouseId) ?? warehouseId}` : ""
              } · ${active} in progress${late ? ` · ${late} late` : ""}. Refreshes every 20 seconds.`
        }
        badge={late ? <Badge tone="bad">{late} late</Badge> : undefined}
      />

      {result === "failed" ? (
        <Callout tone="bad" title="Could not load orders">
          Check that the order service is running, then reload.
        </Callout>
      ) : (
        <Card className="rise" flush>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <Segmented
              options={FILTERS.map((f) => ({
                id: f.value,
                label: f.label,
                href: href(f.value, q),
              }))}
              current={status && status in ORDER_STATUS ? status : "all"}
            />
            <SearchFilter
              placeholder="Order number or customer"
              className="ml-auto w-full sm:w-72"
            />
          </div>
          {orders.length === 0 ? (
            <EmptyState icon={<ShoppingBag className="size-5" />} title="No orders here">
              {needle
                ? `Nothing matches "${q}".`
                : "Orders with this status show here as they come in."}
            </EmptyState>
          ) : (
            <Table maxHeight="calc(100vh - 16rem)">
              <THead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  {warehouseId ? null : <Th className="hidden lg:table-cell">Warehouse</Th>}
                  <Th align="right" className="hidden xl:table-cell">
                    Items
                  </Th>
                  <Th align="right">Total</Th>
                  <Th className="hidden xl:table-cell">Payment</Th>
                  <Th>Status</Th>
                  <Th className="hidden xl:table-cell">Rider</Th>
                  <Th align="right">Placed</Th>
                </tr>
              </THead>
              <TBody>
                {orders.map((o) => {
                  const s = ORDER_STATUS[o.status];
                  const age = (now - Date.parse(o.placedAt)) / 60_000;
                  const isLate = ACTIVE.has(o.status) && age > o.promisedMins;
                  return (
                    <Tr key={o.id}>
                      <Td className="font-semibold whitespace-nowrap tnum">{o.number}</Td>
                      <Td className="whitespace-nowrap">{o.customerName || "Customer"}</Td>
                      {warehouseId ? null : (
                        <Td muted className="hidden whitespace-nowrap lg:table-cell">
                          {names.get(o.warehouseId) ?? o.warehouseId}
                        </Td>
                      )}
                      <Td align="right" className="hidden xl:table-cell">
                        {o.items.reduce((n, i) => n + i.quantity, 0)}
                      </Td>
                      <Td align="right" className="font-semibold">
                        {rupees(o.totalPaise)}
                      </Td>
                      <Td className="hidden xl:table-cell">
                        <Badge tone={o.paymentMethod === "online" ? "info" : "neutral"} dot={false}>
                          {o.paymentMethod === "online" ? "Online" : "Cash"}
                        </Badge>
                      </Td>
                      <Td>
                        <span className="flex items-center gap-1.5">
                          <Badge tone={s.tone}>{s.label}</Badge>
                          {isLate ? <Badge tone="bad">Late</Badge> : null}
                        </span>
                      </Td>
                      <Td muted={!o.rider} className="hidden whitespace-nowrap xl:table-cell">
                        {o.rider?.name ?? "Not assigned"}
                      </Td>
                      <Td align="right" muted className="whitespace-nowrap">
                        {time(o.placedAt)}
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
