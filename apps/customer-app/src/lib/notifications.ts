import type { ListNotificationsResponse, Notification, StockSubscription } from "@qc/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/auth";
import { apiFetch, backendEnabled } from "./session";

export {
  dayLabel,
  groupByDay,
  notificationIcon,
  notificationTarget,
  timeLabel,
} from "./notificationRules";

export const notificationsApi = {
  list: (cursor?: string) =>
    apiFetch<ListNotificationsResponse>(
      "GET",
      `/v1/notifications/me?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  unread: () => apiFetch<{ unread: number }>("GET", "/v1/notifications/me/unread-count"),
  markRead: (id: string) =>
    apiFetch<Notification>("POST", `/v1/notifications/me/${id}/read`, { body: {} }),
  markAllRead: () =>
    apiFetch<{ updated: number }>("POST", "/v1/notifications/me/read-all", { body: {} }),
  subscriptions: () =>
    apiFetch<{ items: StockSubscription[] }>("GET", "/v1/notifications/me/subscriptions").then(
      (r) => r.items,
    ),
  subscribe: (productId: string, warehouseId: string) =>
    apiFetch<StockSubscription>("POST", "/v1/notifications/me/subscriptions", {
      body: { productId, warehouseId },
    }),
  unsubscribe: (productId: string, warehouseId: string) =>
    apiFetch<{ ok: true }>("DELETE", "/v1/notifications/me/subscriptions", {
      body: { productId, warehouseId },
    }),
};

const keys = {
  unread: ["notifications", "unread"] as const,
  list: ["notifications", "list"] as const,
  subscriptions: ["notifications", "subscriptions"] as const,
};

/** Only a real signed in session has an inbox; demo mode has none. */
function useInboxEnabled(): boolean {
  const token = useAuthStore((s) => s.accessToken);
  return backendEnabled && Boolean(token);
}

/** Unread count for the bell, refreshed every 30 s while the app is in front. */
export function useUnreadCount() {
  const enabled = useInboxEnabled();
  return useQuery({
    queryKey: keys.unread,
    queryFn: notificationsApi.unread,
    enabled,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
    select: (r) => r.unread,
  });
}

export function useNotifications() {
  const enabled = useInboxEnabled();
  return useInfiniteQuery({
    queryKey: keys.list,
    queryFn: ({ pageParam }) => notificationsApi.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
    staleTime: 10_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.unread });
      void qc.invalidateQueries({ queryKey: keys.list });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.setQueryData(keys.unread, { unread: 0 });
      void qc.invalidateQueries({ queryKey: keys.list });
    },
  });
}

/** Items the customer asked to be told about, so Notify me buttons show the right state. */
export function useStockSubscriptions() {
  const enabled = useInboxEnabled();
  return useQuery({
    queryKey: keys.subscriptions,
    queryFn: notificationsApi.subscriptions,
    enabled,
    staleTime: 60_000,
  });
}

export function useToggleStockSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { productId: string; warehouseId: string; subscribe: boolean }) =>
      input.subscribe
        ? notificationsApi.subscribe(input.productId, input.warehouseId)
        : notificationsApi.unsubscribe(input.productId, input.warehouseId),
    // Optimistic: the button flips at once and rolls back if the server says no
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: keys.subscriptions });
      const previous = qc.getQueryData<StockSubscription[]>(keys.subscriptions);
      const others = (previous ?? []).filter(
        (s) => !(s.productId === input.productId && s.warehouseId === input.warehouseId),
      );
      qc.setQueryData<StockSubscription[]>(
        keys.subscriptions,
        input.subscribe
          ? [
              {
                id: "pending",
                productId: input.productId,
                warehouseId: input.warehouseId,
                createdAt: new Date().toISOString(),
              },
              ...others,
            ]
          : others,
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      qc.setQueryData(keys.subscriptions, context?.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.subscriptions });
    },
  });
}

export function useInboxAvailable(): boolean {
  return useInboxEnabled();
}
