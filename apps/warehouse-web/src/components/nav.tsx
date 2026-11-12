"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useWarehouse } from "../lib/providers";
import { WAREHOUSES } from "../lib/helpers";

const ITEMS = [
  { href: "/", label: "Queue" },
  { href: "/handover", label: "Handover" },
  { href: "/inventory", label: "Inventory" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me, warehouseId, setWarehouseId } = useWarehouse();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Main" className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/" || pathname.startsWith("/orders")
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                active ? "bg-brand-100 text-brand-900" : "text-ink-700 hover:bg-surface"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3 pt-6">
        {me.role === "admin" ? (
          <label className="block text-xs font-bold uppercase tracking-wide text-ink-500">
            Warehouse
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-2 text-sm font-semibold normal-case text-ink-900"
            >
              {WAREHOUSES.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-xs font-bold uppercase tracking-wide text-ink-500">
            {WAREHOUSES.find((w) => w.id === warehouseId)?.name ?? warehouseId}
          </p>
        )}
        <div className="rounded-lg bg-surface px-3 py-2">
          <p className="truncate text-sm font-bold">{me.name}</p>
          <p className="text-xs text-ink-500">{me.role.replace("_", " ")}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-surface"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
