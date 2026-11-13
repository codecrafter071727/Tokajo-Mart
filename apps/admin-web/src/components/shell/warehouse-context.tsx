"use client";

import type { AdminWarehouse } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { gw } from "../../lib/gw";
import { WAREHOUSE_COOKIE } from "../../lib/warehouse-cookie";

type WarehouseContextValue = {
  /** The chosen warehouse id, or "" for all warehouses */
  warehouseId: string;
  warehouses: AdminWarehouse[];
  loading: boolean;
  setWarehouseId: (id: string) => void;
  nameOf: (id: string) => string;
};

const Context = createContext<WarehouseContextValue | null>(null);

/** Holds the warehouse switcher's choice for every page. Server pages read the same cookie. */
export function WarehouseProvider({
  initial,
  enabled,
  children,
}: {
  initial: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [warehouseId, setId] = useState(initial);
  const list = useQuery({
    queryKey: ["warehouses"],
    enabled,
    staleTime: 60_000,
    queryFn: () => gw<{ items: AdminWarehouse[] }>("GET", "/v1/inventory/warehouses"),
  });
  const warehouses = useMemo(() => list.data?.items ?? [], [list.data]);

  const setWarehouseId = useCallback(
    (id: string) => {
      setId(id);
      document.cookie = `${WAREHOUSE_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${
        id ? 365 * 86_400 : 0
      }; samesite=lax`;
      // Server rendered pages pick the new choice up on refresh
      router.refresh();
    },
    [router],
  );
  const nameOf = useCallback(
    (id: string) => warehouses.find((w) => w.id === id)?.name ?? id,
    [warehouses],
  );

  const value = useMemo(
    () => ({ warehouseId, warehouses, loading: list.isPending, setWarehouseId, nameOf }),
    [warehouseId, warehouses, list.isPending, setWarehouseId, nameOf],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWarehouse(): WarehouseContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("useWarehouse needs the WarehouseProvider from the shell.");
  return value;
}
