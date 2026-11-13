"use client";

import type {
  AdminOrder,
  AdminOrderDetail,
  AdminPaymentDetail,
  AdminRefundBody,
  OrderHistoryEntry,
  OrderStatus,
} from "@qc/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GwError, gw, qs } from "./gw";

export const ACTIVE_STATUSES: OrderStatus[] = [
  "confirmed",
  "packing",
  "packed",
  "picked_up",
  "out_for_delivery",
];
export const isActive = (status: OrderStatus) => ACTIVE_STATUSES.includes(status);
/** An admin may cancel anything not already finished */
export const isCancellable = (status: OrderStatus) =>
  !["delivered", "cancelled", "expired"].includes(status);

export type OrderFilter = {
  status?: string;
  paymentMethod?: string;
  q?: string;
  from?: string;
  to?: string;
  userId?: string;
  warehouseId?: string;
};

export function useAdminOrders(
  filter: OrderFilter,
  options: { live?: boolean; limit?: number } = {},
) {
  return useQuery({
    queryKey: ["admin-orders", filter, options.limit ?? 200],
    refetchInterval: options.live ? 15_000 : false,
    placeholderData: (previous) => previous,
    queryFn: () =>
      gw<{ items: AdminOrder[] }>(
        "GET",
        `/v1/orders/admin${qs({ ...filter, limit: options.limit ?? 200 })}`,
      ),
  });
}

export function useAdminOrder(id: string) {
  return useQuery({
    queryKey: ["admin-order", id],
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && (isActive(status) || status === "pending_payment") ? 15_000 : false;
    },
    queryFn: () => gw<AdminOrderDetail>("GET", `/v1/orders/admin/${id}`),
  });
}

export function useOrderHistory(id: string, enabled = true) {
  return useQuery({
    queryKey: ["order-history", id],
    enabled,
    queryFn: () => gw<{ items: OrderHistoryEntry[] }>("GET", `/v1/orders/${id}/history`),
  });
}

/** The online payment of an order, or null when it has none (cash, or never opened). */
export function usePaymentDetail(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["payment-detail", orderId],
    enabled,
    queryFn: async () => {
      try {
        return await gw<AdminPaymentDetail>("GET", `/v1/payments/admin/${orderId}`);
      } catch (error) {
        if (error instanceof GwError && error.status === 404) return null;
        throw error;
      }
    },
  });
}

/** Refreshes every view an order or payment change can affect. */
export function useInvalidateOrder() {
  const client = useQueryClient();
  return async (orderId: string) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["admin-order", orderId] }),
      client.invalidateQueries({ queryKey: ["order-history", orderId] }),
      client.invalidateQueries({ queryKey: ["payment-detail", orderId] }),
      client.invalidateQueries({ queryKey: ["admin-orders"] }),
      client.invalidateQueries({ queryKey: ["admin-payments"] }),
      client.invalidateQueries({ queryKey: ["admin-orders-live"] }),
    ]);
  };
}

export function useCancelOrder(orderId: string) {
  const invalidate = useInvalidateOrder();
  return useMutation({
    mutationFn: (reason: string) => gw("POST", `/v1/orders/${orderId}/cancel`, { reason }),
    onSuccess: () => invalidate(orderId),
  });
}

/** One Idempotency-Key per dialog, so pressing Refund twice cannot refund twice. */
export function useRefund(orderId: string, idempotencyKey: string) {
  const invalidate = useInvalidateOrder();
  return useMutation({
    mutationFn: async (body: AdminRefundBody) => {
      const res = await fetch(`/api/v1/payments/admin/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify(body),
      });
      const payload: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const error = (payload as { error?: { message?: string } } | null)?.error;
        throw new GwError(error?.message ?? `Refund failed (${res.status}).`, res.status);
      }
      return payload as AdminPaymentDetail;
    },
    onSuccess: () => invalidate(orderId),
  });
}
