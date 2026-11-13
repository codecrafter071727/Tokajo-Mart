import type { AdminOrder, OrderStatus } from "@qc/contracts";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoSubmitSelect } from "../../components/auto-submit-select";
import {
  Alert,
  Badge,
  chipClass,
  EmptyRow,
  PageHeader,
  TableShell,
  td,
  tdNum,
  th,
  thNum,
  Toolbar,
} from "../../components/ui";
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

  const count = orders === "failed" ? null : orders.length;
  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={
          count === null
            ? "Everything placed across the network, newest first."
            : `${count} ${count === 1 ? "order" : "orders"}, newest first.`
        }
      />
      <Toolbar>
        <nav className="flex flex-wrap gap-1.5" aria-label="Filter by status">
          {FILTERS.map((f) => {
            const active = (status ?? "all") === f.value;
            return (
              <Link
                key={f.value}
                href={href(f.value, warehouseId)}
                aria-current={active ? "page" : undefined}
                className={chipClass(active)}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>
        {warehouses.length > 1 ? (
          <form method="get" className="ml-auto">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <AutoSubmitSelect name="warehouseId" label="Warehouse" defaultValue={warehouseId ?? ""}>
              <option value="">All warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </AutoSubmitSelect>
            <noscript>
              <button type="submit">Apply</button>
            </noscript>
          </form>
        ) : null}
      </Toolbar>

      {orders === "failed" ? (
        <Alert>Could not load orders. Check that the order service is running, then reload.</Alert>
      ) : (
        <TableShell>
          <table>
            <thead>
              <tr>
                <th className={th}>Order</th>
                <th className={th}>Customer</th>
                <th className={`${thNum} hidden xl:table-cell`}>Items</th>
                <th className={thNum}>Total</th>
                <th className={`${th} hidden xl:table-cell`}>Payment</th>
                <th className={th}>Status</th>
                <th className={th}>Rider</th>
                <th className={thNum}>Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className={`${td} whitespace-nowrap font-semibold tabular-nums`}>
                    {o.number}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{o.customerName || "Customer"}</td>
                  <td className={`${tdNum} hidden xl:table-cell`}>
                    {o.items.reduce((n, i) => n + i.quantity, 0)}
                  </td>
                  <td className={`${tdNum} font-semibold`}>{rupees(o.totalPaise)}</td>
                  <td className={`${td} hidden text-ink-500 xl:table-cell`}>Cash</td>
                  <td className={td}>
                    <Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge>
                  </td>
                  <td className={`${td} whitespace-nowrap ${o.rider ? "" : "text-ink-300"}`}>
                    {o.rider?.name ?? "Not assigned"}
                  </td>
                  <td className={`${tdNum} whitespace-nowrap text-ink-500`}>{time(o.placedAt)}</td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <EmptyRow colSpan={8}>No orders with this status yet.</EmptyRow>
              ) : null}
            </tbody>
          </table>
        </TableShell>
      )}
    </>
  );
}
