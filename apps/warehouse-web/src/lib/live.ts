"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Handover, QueueOrder } from "@qc/contracts";
import { api } from "./api";
import { useWarehouse } from "./providers";

/** The live queue. Shared by the top bar counts and the queue page, so it is fetched once. */
export function useQueue() {
  const { scope, warehouseId } = useWarehouse();
  return useQuery({
    queryKey: ["queue", warehouseId],
    queryFn: () => api<{ items: QueueOrder[] }>(`/v1/orders/queue${scope ? `?${scope}` : ""}`),
    refetchInterval: 4000,
  });
}

export function useHandovers() {
  const { scope, warehouseId } = useWarehouse();
  return useQuery({
    queryKey: ["handover", warehouseId],
    queryFn: () => api<{ items: Handover[] }>(`/v1/delivery/handovers${scope ? `?${scope}` : ""}`),
    refetchInterval: 4000,
  });
}

/** The current time, ticking, so timers on screen move between fetches. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
