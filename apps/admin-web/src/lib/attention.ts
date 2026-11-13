"use client";

import type { AdminOrder, AdminRider, StockRow } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import { useWarehouse } from "../components/shell/warehouse-context";
import { gw, qs } from "./gw";
import { useProductNames } from "./products";

export type AttentionKind = "late" | "unpaid" | "out" | "low" | "closed" | "no_riders";
export type AttentionItem = {
  kind: AttentionKind;
  title: string;
  detail: string;
  href: string;
  /** Lower is more urgent */
  rank: number;
};

const ACTIVE = new Set(["confirmed", "packing", "packed", "picked_up", "out_for_delivery"]);
const LOW_STOCK = 3;

const minutesSince = (iso: string, now: number) => Math.floor((now - Date.parse(iso)) / 60_000);

/** Orders across the network (or the chosen warehouse), refreshed often: they drive the alerts. */
export function useLiveOrders() {
  const { warehouseId } = useWarehouse();
  return useQuery({
    queryKey: ["admin-orders-live", warehouseId],
    refetchInterval: 20_000,
    queryFn: () =>
      gw<{ items: AdminOrder[] }>(
        "GET",
        `/v1/orders/admin${qs({ warehouseId: warehouseId || undefined, limit: 200 })}`,
      ),
  });
}

/** Stock for every warehouse in view. Admins must ask per warehouse, so this asks for each one. */
export function useStockInView() {
  const { warehouseId, warehouses } = useWarehouse();
  const ids = warehouseId ? [warehouseId] : warehouses.map((w) => w.id);
  return useQuery({
    queryKey: ["stock-in-view", ids.join(",")],
    enabled: ids.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const lists = await Promise.all(
        ids.map((id) =>
          gw<{ items: StockRow[] }>(
            "GET",
            `/v1/inventory/stock${qs({ warehouseId: id, limit: 200 })}`,
          ),
        ),
      );
      return lists.flatMap((l) => l.items);
    },
  });
}

export function useRidersLive() {
  const { warehouseId } = useWarehouse();
  return useQuery({
    queryKey: ["riders-live", warehouseId],
    refetchInterval: 30_000,
    queryFn: () =>
      gw<{ items: AdminRider[] }>(
        "GET",
        `/v1/delivery/admin/riders${qs({ warehouseId: warehouseId || undefined })}`,
      ),
  });
}

/**
 * Everything someone should look at now, most urgent first: orders past their promised time,
 * online payments stuck, stock that ran out or is nearly out, closed warehouses and warehouses
 * with orders but no rider online. Shared by the overview and the bell in the top bar.
 */
export function useAttention(): { items: AttentionItem[]; loading: boolean } {
  const { warehouseId, warehouses, nameOf } = useWarehouse();
  const orders = useLiveOrders();
  const stock = useStockInView();
  const riders = useRidersLive();
  const names = useProductNames();
  const now = Date.now();
  const items: AttentionItem[] = [];

  for (const o of orders.data?.items ?? []) {
    const age = minutesSince(o.placedAt, now);
    if (ACTIVE.has(o.status) && age > o.promisedMins) {
      items.push({
        kind: "late",
        title: `Order ${o.number} is late`,
        detail: `${age - o.promisedMins} min past the ${o.promisedMins} min promise · ${nameOf(o.warehouseId)}`,
        href: `/orders?q=${encodeURIComponent(o.number)}`,
        rank: 0,
      });
    }
    if (o.status === "pending_payment" && age > 10) {
      items.push({
        kind: "unpaid",
        title: `Order ${o.number} is waiting for payment`,
        detail: `Placed ${age} min ago and not paid yet`,
        href: `/orders?q=${encodeURIComponent(o.number)}`,
        rank: 3,
      });
    }
  }

  for (const s of stock.data ?? []) {
    const product = names.data?.get(s.productId);
    const label = product
      ? `${product.emoji ? `${product.emoji} ` : ""}${product.name}`
      : s.productId;
    if (s.available === 0) {
      items.push({
        kind: "out",
        title: `${label} is out of stock`,
        detail: `${nameOf(s.warehouseId)} · ${s.reserved} held for orders`,
        href: `/inventory?q=${encodeURIComponent(s.productId)}`,
        rank: 1,
      });
    } else if (s.available <= LOW_STOCK) {
      items.push({
        kind: "low",
        title: `${label} is running low`,
        detail: `${s.available} left at ${nameOf(s.warehouseId)}`,
        href: `/inventory?q=${encodeURIComponent(s.productId)}`,
        rank: 4,
      });
    }
  }

  const inView = warehouseId ? warehouses.filter((w) => w.id === warehouseId) : warehouses;
  for (const w of inView) {
    if (!w.open) {
      items.push({
        kind: "closed",
        title: `${w.name} is closed`,
        detail: "Customers in its area cannot order",
        href: "/warehouses",
        rank: 2,
      });
      continue;
    }
    const busy = (orders.data?.items ?? []).some(
      (o) => o.warehouseId === w.id && ACTIVE.has(o.status),
    );
    const online = (riders.data?.items ?? []).some(
      (r) => r.warehouseId === w.id && r.status !== "offline",
    );
    if (busy && riders.data && !online) {
      items.push({
        kind: "no_riders",
        title: `No riders online at ${w.name}`,
        detail: "Orders are waiting and nobody can take them",
        href: "/riders",
        rank: 1,
      });
    }
  }

  items.sort((a, b) => a.rank - b.rank);
  return {
    items,
    loading: orders.isPending || stock.isPending || riders.isPending,
  };
}
