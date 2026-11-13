import type { Tracking } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useAuthStore } from "../store/auth";
import { apiFetch, backendEnabled, gatewayBase } from "./session";

export { freshness, layoutPoints } from "./trackingMath";

/** Statuses during which the rider's position is shared with the customer */
export const ON_THE_WAY = new Set(["picked_up", "out_for_delivery"]);

/** Where the rider is, polled every 5 seconds while the order is on its way. */
export function useTracking(orderId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["tracking", orderId],
    enabled: Boolean(orderId) && enabled && backendEnabled,
    queryFn: () =>
      apiFetch<Tracking>(
        "GET",
        `/v1/delivery/orders/${encodeURIComponent(orderId as string)}/tracking`,
      ),
    refetchInterval: (query) => (query.state.data?.active === false ? false : 5000),
    retry: 1,
  });
}

/**
 * The door photo for a delivered order. Images cannot send a token on the web, so there it is
 * fetched as a blob; on a phone the image loader sends the header itself.
 */
export function useDoorPhoto(orderId: string | undefined, available: boolean) {
  const token = useAuthStore((s) => s.accessToken);
  const [webUri, setWebUri] = useState<string | null>(null);
  const url = orderId ? `${gatewayBase}/v1/delivery/orders/${encodeURIComponent(orderId)}/pod` : "";

  useEffect(() => {
    if (Platform.OS !== "web" || !available || !url || !token) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void fetch(url, { headers: { authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setWebUri(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [available, url, token]);

  if (!available || !url || !token || !backendEnabled) return null;
  if (Platform.OS === "web") return webUri ? { uri: webUri } : null;
  return { uri: url, headers: { authorization: `Bearer ${token}` } };
}
