import type { AdminOrder, OrderStatus } from "@qc/contracts";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, PageHeader, TableShell, td, th } from "../../components/ui";
import { rupees } from "../../lib/api";
import { ACCESS_COOKIE, GATEWAY_URL } from "../../lib/session";

// A live view of what is being placed and packed, so never cached
export const dynamic = "force-dynamic";

type Tone = "green" | "amber" | "red" | "gray" | "blue";
const STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending_payment: { label: "Awaiting payment", tone: "gray" },
  confirmed: { label: "Confirmed", tone: "blue" },
  packing: { label: "Packing", tone: "amber" },
  packed: { label: "Packed", tone: "amber" },
  picked_up: { label: "Picked up", tone: "amber" },
  out_for_delivery: { label: "Out for delivery", tone: "amber" },
  delivered: { label: "Delivered", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
  payment_failed: { label: "Payment failed", tone: "red" },
  expired: { label: "Expired", tone: "gray" },
};

const FILTERS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "packing", label: "Packing" },
  { value: "packed", label: "Packed" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const href = (status: string, warehouseId: string | undefined) => {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (warehouseId) params.set("warehouseId", warehouseId);
  return params.size > 0 ? `/orders?${params}` : "/orders";
};

const time = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

async function loadWarehouses(): Promise<{ id: string; name: string }[]> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/inventory/warehouses`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as { items: { id: string; name: string }[] }).items : [];
  } catch {
    return [];
  }
}

async function load(
  status: string | undefined,
  warehouseId: string | undefined,
): Promise<AdminOrder[] | "expired" | "failed"> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const params = new URLSearchParams();
  if (status && status in STATUS) params.set("status", status);
  if (warehouseId) params.set("warehouseId", warehouseId);
  const query = params.size > 0 ? `?${params}` : "";
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/orders/admin${query}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 401) return "expired";
    if (!res.ok) return "failed";
    return ((await res.json()) as { items: AdminOrder[] }).items;
  } catch {
    return "failed";
  }
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; warehouseId?: string }>;
}) {
  const { status, warehouseId } = await searchParams;
  const [orders, warehouses] = await Promise.all([load(status, warehouseId), loadWarehouses()]);
  if (orders === "expired") redirect("/session/refresh?next=/orders");

  return (
    <>
      <PageHeader title="Orders" subtitle="Everything placed across the network, newest first." />
      {warehouses.length > 1 ? (
        <form method="get" className="mb-3 flex items-center gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <select
            name="warehouseId"
            aria-label="Warehouse"
            defaultValue={warehouseId ?? ""}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold"
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold"
          >
            Apply
          </button>
        </form>
      ) : null}
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter by status">
        {FILTERS.map((f) => {
          const active = (status ?? "all") === f.value;
          return (
            <Link
              key={f.value}
              href={href(f.value, warehouseId)}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                active
                  ? "border-brand-600 bg-brand-100 text-brand-900"
                  : "border-line bg-white text-ink-700"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {orders === "failed" ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
        >
          Could not load orders. Check that the order service is running, then reload.
        </p>
      ) : (
        <TableShell>
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                {[
                  "Order",
                  "Customer",
                  "Items",
                  "Total",
                  "Payment",
                  "Status",
                  "Rider",
                  "Placed",
                ].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0 hover:bg-brand-50/40">
                  <td className={`${td} font-bold`}>{o.number}</td>
                  <td className={td}>{o.customerName || "Customer"}</td>
                  <td className={`${td} tabular-nums`}>
                    {o.items.reduce((n, i) => n + i.quantity, 0)}
                  </td>
                  <td className={`${td} font-bold tabular-nums`}>{rupees(o.totalPaise)}</td>
                  <td className={td}>
                    <Badge tone="amber">COD</Badge>
                  </td>
                  <td className={td}>
                    <Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge>
                  </td>
                  <td className={`${td} ${o.rider ? "" : "text-ink-500"}`}>
                    {o.rider?.name ?? "Not assigned"}
                  </td>
                  <td className={`${td} tabular-nums text-ink-500`}>{time(o.placedAt)}</td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td className={`${td} py-10 text-center text-ink-500`} colSpan={8}>
                    No orders here yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableShell>
      )}
    </>
  );
}
