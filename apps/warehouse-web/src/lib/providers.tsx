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
  if (!data) {
    // A quiet frame while we read who is signed in, so the screen does not flash empty
    return (
      <div className="min-h-screen" aria-busy="true">
        <div className="h-16 border-b border-line bg-white" />
        <div className="mx-auto grid max-w-[1440px] gap-3 px-4 py-6 md:grid-cols-4 lg:px-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-line/70" />
          ))}
        </div>
      </div>
    );
  }
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
