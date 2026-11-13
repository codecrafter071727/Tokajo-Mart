"use client";

import { useQuery } from "@tanstack/react-query";
import type { StockAlertsResponse } from "@qc/contracts";
import { api } from "./api";
import { useWarehouse } from "./providers";

/** Out of stock, expiring and expired counts for the tab badge, refreshed every minute. */
export function useStockAlerts() {
  const { scope, warehouseId } = useWarehouse();
  return useQuery({
    queryKey: ["stock-alerts", warehouseId],
    queryFn: () =>
      api<StockAlertsResponse>(`/v1/inventory/alerts?expiryDays=7${scope ? `&${scope}` : ""}`),
    refetchInterval: 60_000,
  });
}
