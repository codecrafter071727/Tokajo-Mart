"use client";

import type { AdminDeliveriesResponse, AdminRiderDetail, AdminUser } from "@qc/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PageActions } from "../../../components/page-actions";
import { BlockDialog } from "../../../components/user-actions";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  EmptyRow,
  LoadingRows,
  PageHeader,
  Panel,
  td,
  tdNum,
  th,
  thNum,
} from "../../../components/kit";
import { KeyValue, Stat } from "../../../components/ui/core";
import { Bike, Clock, IndianRupee, KeyRound, MapPin, Phone } from "../../../components/ui/icons";
import { rupees } from "../../../lib/api";
import { errorMessage, gw, GwError } from "../../../lib/gw";
import { DELIVERY_STATUS, dateTime, minutesLabel } from "../../../lib/ops";
import { useUserList, useWarehouses } from "../../../lib/users";
import { LIVE, RiderDialog } from "../riders";

export function RiderDetail({ id }: { id: string }) {
  const detail = useQuery({
    queryKey: ["rider-detail", id],
    refetchInterval: 15_000,
    queryFn: () => gw<AdminRiderDetail>("GET", `/v1/delivery/admin/riders/${id}`),
  });
  const deliveries = useInfiniteQuery({
    queryKey: ["rider-deliveries", id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      gw<AdminDeliveriesResponse>(
        "GET",
        `/v1/delivery/admin/riders/${id}/deliveries?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  // The account itself (blocked or not, to edit) comes from identity
  const users = useUserList({ role: "rider" }, 100);
  const account: AdminUser | undefined = users.data?.pages
    .flatMap((p) => p.items)
    .find((u) => u.id === id);
  const warehouses = useWarehouses();

  const [dialog, setDialog] = useState<"edit" | "block" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (detail.isError) {
    const missing = detail.error instanceof GwError && detail.error.status === 404;
    return (
      <>
        <PageHeader title="Rider" crumbs={[{ label: "Riders", href: "/riders" }]} />
        <Alert title={missing ? "Rider not found" : "Could not load this rider"}>
          {missing
            ? "They may have been removed, or the link is wrong."
            : errorMessage(detail.error)}
        </Alert>
      </>
    );
  }

  const d = detail.data;
  const rider = d?.rider;
  const blocked = account?.status === "blocked";
  const warehouseName =
    warehouses.data?.items.find((w) => w.id === rider?.warehouseId)?.name ?? rider?.warehouseId;
  const rows = deliveries.data?.pages.flatMap((p) => p.items) ?? [];

  const done = (message: string) => {
    setDialog(null);
    setNotice(message);
    void detail.refetch();
  };

  return (
    <>
      <PageHeader
        title={rider?.name ?? "Rider"}
        crumbs={[{ label: "Riders", href: "/riders" }, { label: rider?.name ?? "Rider" }]}
        badge={
          rider ? (
            blocked ? (
              <Badge tone="red">Blocked</Badge>
            ) : (
              <Badge tone={LIVE[rider.status].tone}>{LIVE[rider.status].label}</Badge>
            )
          ) : null
        }
        description={
          rider ? `${rider.vehicle || "No vehicle on record"} · ${warehouseName ?? ""}` : undefined
        }
      />
      <PageActions>
        <Button disabled={!account} onClick={() => setDialog("edit")}>
          Edit
        </Button>
        <Button
          variant={blocked ? "secondary" : "danger"}
          disabled={!account}
          onClick={() => setDialog("block")}
        >
          {blocked ? "Unblock" : "Block"}
        </Button>
      </PageActions>

      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          delay={0}
          icon={Bike}
          label="Delivered today"
          value={d ? d.today.deliveries : "-"}
          hint={d ? `${d.last30Days.deliveries} in the last 30 days` : " "}
        />
        <Stat
          delay={1}
          icon={IndianRupee}
          label="Earned today"
          value={d ? rupees(d.today.earningsPaise) : "-"}
          hint={d ? `${rupees(d.last30Days.earningsPaise)} in 30 days, pay plus tips` : " "}
        />
        <Stat
          delay={2}
          icon={Clock}
          label="Average time, 30 days"
          value={d ? minutesLabel(d.last30Days.averageMins) : "-"}
          hint="From packed to delivered"
        />
        <Stat
          delay={3}
          icon={KeyRound}
          label="Wrong door codes, 30 days"
          value={d ? d.last30Days.wrongCodes : "-"}
          tone={d && d.last30Days.wrongCodes > 3 ? "warn" : undefined}
          hint="Codes typed at the customer's door that did not match"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel
            title="Right now"
            description={
              d?.current ? "The delivery this rider is on" : "Not on a delivery at the moment"
            }
          >
            {d?.current ? (
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{d.current.orderNumber}</span>
                    <Badge tone={DELIVERY_STATUS[d.current.status].tone}>
                      {DELIVERY_STATUS[d.current.status].label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-[13px] text-muted">
                    <MapPin className="size-3.5" aria-hidden />
                    <span className="truncate">
                      {d.current.customerName ? `${d.current.customerName}, ` : ""}
                      {d.current.customerAddress}
                    </span>
                  </div>
                  <div className="text-[13px] text-muted">
                    {d.current.itemCount} items · {d.current.distanceKm.toFixed(1)} km
                    {d.current.codPaise !== null
                      ? ` · collect ${rupees(d.current.codPaise)} cash`
                      : " · paid online"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tnum text-2xl font-bold text-ink">
                    {minutesLabel(d.current.minutes)}
                  </div>
                  <div className="text-xs text-muted">since it was packed</div>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-muted">
                {rider?.status === "online"
                  ? "Online and waiting for an order."
                  : "Offline. New orders go to riders who are online."}
              </p>
            )}
          </Panel>

          <Panel title="Deliveries" description="Newest first" flush>
            <div className="data-table overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Order</th>
                    <th className={th}>Status</th>
                    <th className={`${th} hidden xl:table-cell`}>Customer</th>
                    <th className={thNum}>Time</th>
                    <th className={thNum}>Earned</th>
                    <th className={`${th} hidden xl:table-cell`}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.isPending ? (
                    <LoadingRows colSpan={6} rows={5} />
                  ) : deliveries.isError ? (
                    <EmptyRow colSpan={6}>{errorMessage(deliveries.error)}</EmptyRow>
                  ) : rows.length === 0 ? (
                    <EmptyRow colSpan={6}>No deliveries yet.</EmptyRow>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id}>
                        <td className={`${td} font-medium`}>{row.orderNumber}</td>
                        <td className={td}>
                          <Badge tone={DELIVERY_STATUS[row.status].tone}>
                            {DELIVERY_STATUS[row.status].label}
                          </Badge>
                        </td>
                        <td className={`${td} hidden max-w-56 truncate xl:table-cell`}>
                          {row.customerAddress}
                        </td>
                        <td className={tdNum}>{minutesLabel(row.minutes)}</td>
                        <td className={tdNum}>
                          {row.status === "delivered"
                            ? rupees(row.payoutPaise + row.tipPaise)
                            : "-"}
                        </td>
                        <td className={`${td} hidden whitespace-nowrap text-muted xl:table-cell`}>
                          {dateTime(row.deliveredAt ?? row.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {deliveries.hasNextPage ? (
              <div className="border-t border-line p-3">
                <Button
                  small
                  disabled={deliveries.isFetchingNextPage}
                  onClick={() => void deliveries.fetchNextPage()}
                >
                  {deliveries.isFetchingNextPage ? "Loading" : "Load more"}
                </Button>
              </div>
            ) : null}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Profile">
            {rider ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar name={rider.name} size={44} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">{rider.name}</div>
                    <div className="text-xs text-muted">
                      Rated {rider.rating.toFixed(1)} by customers
                    </div>
                  </div>
                </div>
                <KeyValue
                  items={[
                    {
                      label: "Phone",
                      value: rider.phone ? (
                        <a
                          href={`tel:${rider.phone}`}
                          className="inline-flex items-center gap-1.5 hover:text-accent"
                        >
                          <Phone className="size-3.5" aria-hidden />
                          <span className="tnum">{rider.phone}</span>
                        </a>
                      ) : (
                        "Not on record"
                      ),
                    },
                    { label: "Vehicle", value: rider.vehicle || "Not on record" },
                    {
                      label: "Warehouse",
                      value: (
                        <Link
                          href={`/warehouses/${rider.warehouseId}`}
                          className="hover:text-accent hover:underline"
                        >
                          {warehouseName}
                        </Link>
                      ),
                    },
                    { label: "Account", value: blocked ? "Blocked" : "Active" },
                  ]}
                />
              </div>
            ) : (
              <p className="text-[13px] text-muted">Loading</p>
            )}
          </Panel>
          <Panel title="Today">
            <KeyValue
              items={[
                { label: "Delivered", value: d ? d.today.deliveries : "-" },
                { label: "Earned", value: d ? rupees(d.today.earningsPaise) : "-" },
                { label: "Average time", value: d ? minutesLabel(d.today.averageMins) : "-" },
                { label: "Wrong door codes", value: d ? d.today.wrongCodes : "-" },
              ]}
            />
          </Panel>
        </div>
      </div>

      {dialog === "edit" && account ? (
        <RiderDialog rider={account} onClose={() => setDialog(null)} onDone={done} />
      ) : null}
      {dialog === "block" && account ? (
        <BlockDialog user={account} onClose={() => setDialog(null)} onDone={done} />
      ) : null}
    </>
  );
}
