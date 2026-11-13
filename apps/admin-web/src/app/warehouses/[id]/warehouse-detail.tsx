"use client";

import type {
  AdminLiveResponse,
  AdminRider,
  AdminWarehouse,
  QueueResponse,
  StockRow,
} from "@qc/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PageActions } from "../../../components/page-actions";
import {
  Alert,
  Badge,
  Button,
  EmptyRow,
  LoadingRows,
  PageHeader,
  Panel,
  PersonCell,
  td,
  tdNum,
  th,
  thNum,
} from "../../../components/kit";
import { KeyValue, Stat } from "../../../components/ui/core";
import { AlertTriangle, Bike, Boxes, PackageCheck, Truck } from "../../../components/ui/icons";
import { rupees } from "../../../lib/api";
import { errorMessage, gw } from "../../../lib/gw";
import { DELIVERY_STATUS, LOW_STOCK, minutesLabel } from "../../../lib/ops";
import { LIVE } from "../../riders/riders";
import { OpenCloseDialog, WarehouseDialog } from "../warehouses";
import { SchedulePanel } from "./schedule-panel";

const REFRESH = 10_000;

export function WarehouseDetail({ id }: { id: string }) {
  const q = encodeURIComponent(id);
  const warehouses = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => gw<{ items: AdminWarehouse[] }>("GET", "/v1/inventory/warehouses"),
  });
  const queue = useQuery({
    queryKey: ["warehouse-queue", id],
    refetchInterval: REFRESH,
    queryFn: () => gw<QueueResponse>("GET", `/v1/orders/queue?warehouseId=${q}`),
  });
  const live = useQuery({
    queryKey: ["warehouse-live", id],
    refetchInterval: REFRESH,
    queryFn: () => gw<AdminLiveResponse>("GET", `/v1/delivery/admin/live?warehouseId=${q}`),
  });
  const riders = useQuery({
    queryKey: ["warehouse-riders", id],
    refetchInterval: REFRESH,
    queryFn: () => gw<{ items: AdminRider[] }>("GET", `/v1/delivery/admin/riders?warehouseId=${q}`),
  });
  const stock = useQuery({
    queryKey: ["stock", id],
    queryFn: async () => {
      const rows: StockRow[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 30; page += 1) {
        const res: { items: StockRow[]; nextCursor: string | null } = await gw(
          "GET",
          `/v1/inventory/stock?warehouseId=${q}&limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        );
        rows.push(...res.items);
        cursor = res.nextCursor;
        if (!cursor) break;
      }
      return rows;
    },
  });

  const client = useQueryClient();
  const [dialog, setDialog] = useState<"edit" | "toggle" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const warehouse = warehouses.data?.items.find((w) => w.id === id);
  if (warehouses.isSuccess && !warehouse) {
    return (
      <>
        <PageHeader title="Warehouse" crumbs={[{ label: "Warehouses", href: "/warehouses" }]} />
        <Alert title="Warehouse not found">The link may be wrong, or it was removed.</Alert>
      </>
    );
  }

  const orders = queue.data?.items ?? [];
  const waiting = orders.filter((o) => o.status === "confirmed");
  const packing = orders.filter((o) => o.status === "packing");
  const packed = orders.filter((o) => o.status === "packed");
  const late = orders.filter(
    (o) => Date.now() - new Date(o.placedAt).getTime() > o.promisedMins * 60_000,
  );
  const onRoad = live.data?.items ?? [];
  const team = riders.data?.items ?? [];
  const working = team.filter((r) => r.status !== "offline").length;
  const rows = stock.data ?? [];
  const out = rows.filter((r) => r.available === 0).length;
  const low = rows.filter((r) => r.available > 0 && r.available <= LOW_STOCK).length;

  const done = (message: string) => {
    setDialog(null);
    setNotice(message);
    void client.invalidateQueries({ queryKey: ["warehouses"] });
  };

  return (
    <>
      <PageHeader
        title={warehouse?.name ?? "Warehouse"}
        crumbs={[{ label: "Warehouses", href: "/warehouses" }, { label: warehouse?.name ?? id }]}
        badge={
          warehouse ? (
            <Badge tone={warehouse.open ? "green" : "gray"}>
              {warehouse.open ? "Open" : "Closed"}
            </Badge>
          ) : null
        }
        description={
          warehouse
            ? `Serves customers within ${warehouse.radiusKm} km. Everything here refreshes every 10 seconds.`
            : undefined
        }
      />
      <PageActions>
        <Button disabled={!warehouse} onClick={() => setDialog("edit")}>
          Edit
        </Button>
        <Button
          variant={warehouse?.open ? "danger" : "primary"}
          disabled={!warehouse}
          onClick={() => setDialog("toggle")}
        >
          {warehouse?.open ? "Close warehouse" : "Open warehouse"}
        </Button>
      </PageActions>

      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {warehouse && !warehouse.open ? (
        <div className="mb-4">
          <Alert tone="warning" title="Closed to new orders">
            Customers in this area see that we are closed. Orders already placed carry on.
          </Alert>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          delay={0}
          icon={PackageCheck}
          label="To pack"
          value={queue.data ? waiting.length + packing.length : "-"}
          hint={
            queue.data
              ? `${waiting.length} waiting · ${packing.length} being packed${late.length ? ` · ${late.length} late` : ""}`
              : " "
          }
          tone={late.length ? "bad" : undefined}
        />
        <Stat
          delay={1}
          icon={Truck}
          label="Out for delivery"
          value={live.data ? onRoad.length : "-"}
          hint={queue.data ? `${packed.length} packed and waiting for a rider` : " "}
        />
        <Stat
          delay={2}
          icon={Bike}
          label="Riders working"
          value={riders.data ? `${working} of ${team.length}` : "-"}
          hint="Online or on a delivery"
          tone={riders.data && working === 0 ? "warn" : undefined}
        />
        <Stat
          delay={3}
          icon={Boxes}
          label="Stock health"
          value={stock.data ? `${out} out` : "-"}
          hint={stock.data ? `${low} running low of ${rows.length} products` : " "}
          tone={out ? "bad" : low ? "warn" : stock.data ? "ok" : undefined}
          href={`/inventory?filter=${out ? "out" : "low"}`}
        />
      </div>

      <SchedulePanel warehouseId={id} radiusKm={warehouse?.radiusKm} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Queue" description="Orders waiting to be packed or picked up" flush>
            <div className="data-table overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Order</th>
                    <th className={th}>Status</th>
                    <th className={thNum}>Items</th>
                    <th className={thNum}>Waiting</th>
                    <th className={`${thNum} hidden xl:table-cell`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.isPending ? (
                    <LoadingRows colSpan={5} rows={3} />
                  ) : queue.isError ? (
                    <EmptyRow colSpan={5}>{errorMessage(queue.error)}</EmptyRow>
                  ) : orders.length === 0 ? (
                    <EmptyRow colSpan={5}>Nothing waiting. The queue is clear.</EmptyRow>
                  ) : (
                    orders.map((o) => {
                      const mins = Math.max(
                        0,
                        Math.round((Date.now() - new Date(o.placedAt).getTime()) / 60_000),
                      );
                      const isLate = mins > o.promisedMins;
                      return (
                        <tr key={o.id}>
                          <td className={`${td} font-medium`}>{o.number}</td>
                          <td className={td}>
                            <Badge
                              tone={
                                o.status === "confirmed"
                                  ? "blue"
                                  : o.status === "packing"
                                    ? "amber"
                                    : "green"
                              }
                            >
                              {o.status === "confirmed"
                                ? "Waiting"
                                : o.status === "packing"
                                  ? "Packing"
                                  : "Packed"}
                            </Badge>
                          </td>
                          <td className={tdNum}>{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                          <td className={`${tdNum} ${isLate ? "font-semibold text-bad" : ""}`}>
                            {isLate ? (
                              <span className="mr-2 inline-block rounded-full bg-bad-soft px-1.5 text-[11px] font-semibold">
                                Late
                              </span>
                            ) : null}
                            {minutesLabel(mins)}
                          </td>
                          <td className={`${tdNum} hidden xl:table-cell`}>
                            {rupees(o.totalPaise)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="On the road" description="Deliveries that have left or are about to" flush>
            <div className="data-table overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Order</th>
                    <th className={th}>Status</th>
                    <th className={th}>Rider</th>
                    <th className={thNum}>Since packed</th>
                  </tr>
                </thead>
                <tbody>
                  {live.isPending ? (
                    <LoadingRows colSpan={4} rows={3} />
                  ) : live.isError ? (
                    <EmptyRow colSpan={4}>{errorMessage(live.error)}</EmptyRow>
                  ) : onRoad.length === 0 ? (
                    <EmptyRow colSpan={4}>No deliveries on the road right now.</EmptyRow>
                  ) : (
                    onRoad.map((d) => (
                      <tr key={d.id}>
                        <td className={`${td} font-medium`}>{d.orderNumber}</td>
                        <td className={td}>
                          <Badge tone={DELIVERY_STATUS[d.status].tone}>
                            {DELIVERY_STATUS[d.status].label}
                          </Badge>
                        </td>
                        <td className={td}>
                          {d.rider ? (
                            <Link
                              href={`/riders/${d.rider.id}`}
                              className="hover:text-accent hover:underline"
                            >
                              {d.rider.name}
                            </Link>
                          ) : (
                            <span className="text-muted">Not yet</span>
                          )}
                        </td>
                        <td className={tdNum}>{minutesLabel(d.minutes)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Location">
            {warehouse ? (
              <KeyValue
                items={[
                  { label: "Id", value: <span className="font-mono text-xs">{warehouse.id}</span> },
                  {
                    label: "Coordinates",
                    value: (
                      <span className="tnum">
                        {warehouse.lat.toFixed(4)}, {warehouse.lng.toFixed(4)}
                      </span>
                    ),
                  },
                  { label: "Delivery radius", value: `${warehouse.radiusKm} km` },
                  {
                    label: "Area",
                    value: `About ${Math.round(Math.PI * warehouse.radiusKm ** 2)} sq km`,
                  },
                ]}
              />
            ) : (
              <p className="text-[13px] text-muted">Loading</p>
            )}
          </Panel>

          <Panel
            title="Riders"
            description={riders.data ? `${working} working now` : undefined}
            flush
          >
            {riders.isError ? (
              <div className="p-5 text-[13px] text-bad">{errorMessage(riders.error)}</div>
            ) : team.length === 0 ? (
              <div className="p-5 text-[13px] text-muted">
                {riders.isPending ? "Loading" : "No riders work from here yet."}
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {[...team]
                  .sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name))
                  .map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/riders/${r.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2"
                      >
                        <PersonCell name={r.name} detail={`${r.deliveriesToday} delivered today`} />
                        <Badge tone={LIVE[r.status].tone}>{LIVE[r.status].label}</Badge>
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Stock"
            actions={
              <Link
                href="/inventory"
                className="text-[13px] font-medium text-accent hover:underline"
              >
                Open inventory
              </Link>
            }
          >
            {stock.isError ? (
              <p className="text-[13px] text-bad">{errorMessage(stock.error)}</p>
            ) : (
              <div className="space-y-3">
                {out > 0 ? (
                  <div className="flex items-center gap-2 text-[13px] text-bad">
                    <AlertTriangle className="size-4" aria-hidden />
                    {out} products are out of stock
                  </div>
                ) : null}
                <KeyValue
                  items={[
                    { label: "Products stocked", value: stock.data ? rows.length : "-" },
                    { label: "Running low", value: stock.data ? low : "-" },
                    { label: "Out of stock", value: stock.data ? out : "-" },
                    {
                      label: "Units on hand",
                      value: stock.data ? rows.reduce((n, r) => n + r.onHand, 0) : "-",
                    },
                  ]}
                />
              </div>
            )}
          </Panel>
        </div>
      </div>

      {dialog === "edit" && warehouse ? (
        <WarehouseDialog warehouse={warehouse} onClose={() => setDialog(null)} onDone={done} />
      ) : null}
      {dialog === "toggle" && warehouse ? (
        <OpenCloseDialog warehouse={warehouse} onClose={() => setDialog(null)} onDone={done} />
      ) : null}
    </>
  );
}

/** Riders on a delivery first, then online, then offline. */
const order = (r: AdminRider) => (r.status === "on_delivery" ? 0 : r.status === "online" ? 1 : 2);
