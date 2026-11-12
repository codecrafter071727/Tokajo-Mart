"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { WAREHOUSES } from "./helpers";

export type Me = { id: string; name: string; role: string; warehouseId: string | null };

type Ctx = { me: Me; warehouseId: string; setWarehouseId: (id: string) => void; scope: string };
const WarehouseContext = createContext<Ctx | null>(null);

/** The signed in user and the warehouse their screens are about. Admins choose one. */
export function useWarehouse(): Ctx {
  const ctx = useContext(WarehouseContext);
  if (!ctx) throw new Error("useWarehouse must be used inside the app shell.");
  return ctx;
}

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [picked, setPicked] = useState<string>(WAREHOUSES[0].id);
  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await fetch("/api/auth/me").then((r) => r.json())).user as Me,
    staleTime: Infinity,
  });
  useEffect(() => {
    try {
      const saved = localStorage.getItem("qc_wh");
      if (saved) setPicked(saved);
    } catch {
      // keep the default
    }
  }, []);
  if (!data) return null;
  const isAdmin = data.role === "admin";
  const warehouseId = isAdmin ? picked : (data.warehouseId ?? picked);
  return (
    <WarehouseContext.Provider
      value={{
        me: data,
        warehouseId,
        scope: isAdmin ? `warehouseId=${encodeURIComponent(warehouseId)}` : "",
        setWarehouseId: (id) => {
          setPicked(id);
          try {
            localStorage.setItem("qc_wh", id);
          } catch {
            // not saved, still works for this visit
          }
        },
      }}
    >
      {children}
    </WarehouseContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export { api };
