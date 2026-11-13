"use client";

import type { AdminOrder, AdminUser } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BlockCustomerDialog } from "../../../components/orders/block-dialog";
import { PaymentBadge } from "../../../components/orders/order-ui";
import { useWarehouse } from "../../../components/shell/warehouse-context";
import { Avatar } from "../../../components/ui/brand";
import { Badge, Button, Callout, Card, EmptyState, Stat } from "../../../components/ui/core";
import {
  Ban,
  Calendar,
  CheckCircle2,
  IndianRupee,
  Phone,
  Receipt,
  ShoppingBag,
  Users,
  XCircle,
} from "../../../components/ui/icons";
import { PageHeader } from "../../../components/ui/layout";
import { DetailPageSkeleton, TableSkeleton } from "../../../components/ui/skeleton";
import { Table, TBody, Td, Th, THead } from "../../../components/ui/table";
import { useAdminOrders } from "../../../lib/admin-orders";
import { rupees } from "../../../lib/api";
import { dateTime, fullDate, timeAgo } from "../../../lib/format";
import { GwError, errorMessage, gw } from "../../../lib/gw";
import { ORDER_STATUS } from "../../../lib/order-status";

export function CustomerDetail({ id }: { id: string }) {
  const router = useRouter();
  const { nameOf } = useWarehouse();
  const user = useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => gw<AdminUser>("GET", `/v1/identity/admin/users/${id}`),
  });
  const orders = useAdminOrders({ userId: id }, { limit: 200 });
  const [blocking, setBlocking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const list = useMemo(() => orders.data?.items ?? [], [orders.data]);
  const stats = useMemo(() => summarise(list), [list]);

  if (user.isPending) return <DetailPageSkeleton label="Loading the customer" />;
  if (user.isError) {
    const missing = user.error instanceof GwError && user.error.status === 404;
    return (
      <>
        <PageHeader
          title="Customer"
          crumbs={[{ label: "Customers", href: "/customers" }, { label: "Customer" }]}
        />
        <Card>
          <EmptyState
            icon={<Users className="size-5" />}
            title={missing ? "Customer not found" : "Could not load the customer"}
          >
            {missing ? "The link may be wrong." : errorMessage(user.error)}
          </EmptyState>
        </Card>
      </>
    );
  }

  const c = user.data;
  const name = c.name || "No name yet";
  const blocked = c.status === "blocked";
  const deleted = c.status === "deleted";

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Customers", href: "/customers" }, { label: name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={c.name || "Customer"} size={40} />
            {name}
          </span>
        }
        badge={
          <Badge tone={deleted ? "neutral" : blocked ? "bad" : "ok"}>
            {deleted ? "Deleted" : blocked ? "Blocked" : "Active"}
          </Badge>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {c.phone ? (
              <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-accent tnum">
                <Phone className="size-3.5" /> {c.phone}
              </a>
            ) : null}
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" /> Joined {fullDate(c.createdAt)}
            </span>
          </span>
        }
        actions={
          deleted ? null : (
            <Button
              variant={blocked ? "primary" : "danger"}
              icon={blocked ? CheckCircle2 : Ban}
              onClick={() => setBlocking(true)}
            >
              {blocked ? "Unblock" : "Block"}
            </Button>
          )
        }
      />
      {notice ? <Callout tone="ok">{notice}</Callout> : null}
      {deleted ? (
        <Callout tone="info" title="This customer deleted their account">
          {c.deletedAt ? `Deleted ${dateTime(c.deletedAt)}. ` : ""}Their name, phone, addresses and
          notifications are gone. Past orders stay for tax records without their details.
        </Callout>
      ) : null}
      {blocked ? (
        <Callout tone="bad" title="This customer is blocked">
          They cannot sign in or place orders until you unblock them.
        </Callout>
      ) : null}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat
          delay={0}
          icon={ShoppingBag}
          label="Orders"
          value={stats.orders}
          hint={`${stats.delivered} delivered · ${stats.cancelled} cancelled`}
        />
        <Stat
          delay={1}
          icon={IndianRupee}
          label="Lifetime spend"
          value={rupees(stats.spend)}
          hint="Delivered orders only"
        />
        <Stat
          delay={2}
          icon={Receipt}
          label="Average order"
          value={stats.delivered ? rupees(Math.round(stats.spend / stats.delivered)) : "None yet"}
          hint={stats.online ? `${stats.online} paid online` : "All cash on delivery"}
        />
        <Stat
          delay={3}
          icon={Calendar}
          label="Last order"
          value={stats.last ? timeAgo(stats.last) : "Never"}
          hint={stats.last ? dateTime(stats.last) : "No orders yet"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rise lg:col-span-2" title="Orders" description="Newest first" flush>
          {orders.isError ? (
            <div className="p-4">
              <Callout tone="bad">{errorMessage(orders.error)}</Callout>
            </div>
          ) : orders.isPending ? (
            <TableSkeleton cols={5} rows={5} />
          ) : list.length === 0 ? (
            <EmptyState icon={<ShoppingBag className="size-5" />} title="No orders yet">
              Their orders show here once they place one.
            </EmptyState>
          ) : (
            <Table maxHeight="32rem">
              <THead>
                <tr>
                  <Th>Order</Th>
                  <Th className="hidden 2xl:table-cell">Warehouse</Th>
                  <Th>Status</Th>
                  <Th className="hidden xl:table-cell">Payment</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Placed</Th>
                </tr>
              </THead>
              <TBody>
                {list.map((o) => {
                  const s = ORDER_STATUS[o.status];
                  return (
                    <tr
                      key={o.id}
                      onClick={() => router.push(`/orders/${o.id}`)}
                      className="group cursor-pointer transition-colors hover:bg-surface-2"
                    >
                      <Td className="font-semibold tnum">
                        <Link
                          href={`/orders/${o.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-accent hover:underline"
                        >
                          {o.number}
                        </Link>
                      </Td>
                      <Td muted className="hidden 2xl:table-cell">
                        {nameOf(o.warehouseId)}
                      </Td>
                      <Td>
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </Td>
                      <Td className="hidden xl:table-cell">
                        <PaymentBadge
                          method={o.paymentMethod}
                          status={o.paymentStatus}
                          orderStatus={o.status}
                        />
                      </Td>
                      <Td align="right" className="font-semibold">
                        {rupees(o.totalPaise)}
                      </Td>
                      <Td align="right" muted className="whitespace-nowrap">
                        {dateTime(o.placedAt)}
                      </Td>
                    </tr>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="rise" title="Buys most often">
            {stats.favourites.length === 0 ? (
              <p className="text-[13px] text-muted">Nothing yet.</p>
            ) : (
              <ul className="space-y-3">
                {stats.favourites.map((f) => (
                  <li key={f.productId} className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line">
                      {f.imageUrl ? (
                        <img src={f.imageUrl} alt="" className="size-full object-contain p-0.5" />
                      ) : (
                        <span aria-hidden>{f.emoji || "📦"}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{f.name}</span>
                    <span className="text-xs text-muted tnum">×{f.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="rise" title="Delivery">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
              <dt className="text-muted">Delivered</dt>
              <dd className="flex items-center gap-1 text-ink tnum">
                <CheckCircle2 className="size-3.5 text-ok" /> {stats.delivered}
              </dd>
              <dt className="text-muted">Cancelled</dt>
              <dd className="flex items-center gap-1 text-ink tnum">
                <XCircle className="size-3.5 text-bad" /> {stats.cancelled}
              </dd>
              <dt className="text-muted">Usual address</dt>
              <dd className="text-ink">{stats.address ?? "None yet"}</dd>
            </dl>
          </Card>
        </div>
      </div>

      {blocking ? (
        <BlockCustomerDialog
          user={c}
          onClose={() => setBlocking(false)}
          onDone={(message) => {
            setBlocking(false);
            setNotice(message);
          }}
        />
      ) : null}
    </div>
  );
}

function summarise(orders: AdminOrder[]) {
  const delivered = orders.filter((o) => o.status === "delivered");
  const items = new Map<
    string,
    { productId: string; name: string; emoji: string; imageUrl: string | null; quantity: number }
  >();
  const addresses = new Map<string, number>();
  for (const o of orders) {
    if (o.status === "cancelled" || o.status === "expired") continue;
    for (const i of o.items) {
      const found = items.get(i.productId);
      if (found) found.quantity += i.quantity;
      else
        items.set(i.productId, {
          productId: i.productId,
          name: i.name,
          emoji: i.emoji,
          imageUrl: i.imageUrl,
          quantity: i.quantity,
        });
    }
    const label = `${o.address.tag}, ${o.address.line1}`;
    addresses.set(label, (addresses.get(label) ?? 0) + 1);
  }
  return {
    orders: orders.length,
    delivered: delivered.length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
    online: orders.filter((o) => o.paymentMethod === "online").length,
    spend: delivered.reduce((n, o) => n + o.totalPaise, 0),
    last: orders[0]?.placedAt ?? null,
    favourites: [...items.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    address: [...addresses.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };
}
