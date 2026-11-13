"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useWarehouse } from "../lib/providers";
import { WAREHOUSES, isLate } from "../lib/helpers";
import { useHandovers, useNow, useQueue } from "../lib/live";
import { useStockAlerts } from "../lib/alerts";
import { OrderAlerts } from "./order-alerts";
import { Icon, type IconName } from "./ui";

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Queue", icon: "list" },
  { href: "/handover", label: "Handover", icon: "handover" },
  { href: "/inventory", label: "Inventory", icon: "shelf" },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * The top bar. A bar rather than a sidebar, so a tablet keeps its full width for the queue. Tab
 * counts come from the same live queries the pages use.
 */
export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me, warehouseId, setWarehouseId } = useWarehouse();
  const queue = useQueue();
  const handovers = useHandovers();
  const now = useNow(15_000);

  const orders = queue.data?.items ?? [];
  const toPack = orders.filter((o) => o.status !== "packed").length;
  const late = orders.filter(
    (o) => o.status !== "packed" && isLate(o.placedAt, o.promisedMins, now),
  ).length;
  const waiting = handovers.data?.items.length ?? 0;
  const riderHere = handovers.data?.items.some((h) => h.status === "at_store") ?? false;
  const offline = queue.isError && !queue.isFetching;
  const alerts = useStockAlerts().data?.counts;
  const stockProblems = alerts ? alerts.outOfStock + alerts.expiring + alerts.expired : 0;

  const counts: Record<string, { n: number; alert: boolean } | null> = {
    "/": { n: toPack, alert: late > 0 },
    "/handover": { n: waiting, alert: riderHere },
    "/inventory":
      stockProblems > 0
        ? { n: stockProblems, alert: (alerts?.expired ?? 0) > 0 || (alerts?.outOfStock ?? 0) > 0 }
        : null,
  };

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 lg:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Queue">
          <span className="grid size-9 place-items-center rounded-lg bg-brand-600 text-lg font-extrabold text-ink-900">
            Q
          </span>
          <span className="hidden text-base font-extrabold leading-tight xl:block">
            Tokajo
            <span className="block text-xs font-semibold text-ink-500">Warehouse</span>
          </span>
        </Link>

        <nav aria-label="Main" className="flex h-full items-stretch gap-1">
          {ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/" || pathname.startsWith("/orders")
                : pathname.startsWith(item.href);
            const count = counts[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-2 px-3 text-base font-bold transition lg:px-4 ${
                  active ? "text-ink-900" : "text-ink-500 hover:text-ink-900"
                }`}
              >
                <Icon name={item.icon} />
                {item.label}
                {count && count.n > 0 ? (
                  <span
                    className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-extrabold tabular-nums ${
                      count.alert ? "bg-red-600 text-white" : "bg-ink-900 text-white"
                    }`}
                  >
                    {count.n}
                  </span>
                ) : null}
                {active ? (
                  <span className="absolute inset-x-2 bottom-0 h-1 rounded-t-full bg-brand-600" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span
            className={`hidden items-center gap-2 rounded-full px-3 py-1 text-sm font-bold md:inline-flex ${
              offline ? "bg-red-50 text-red-800" : "bg-brand-50 text-brand-900"
            }`}
            role="status"
          >
            <span className="relative flex size-2.5">
              {!offline ? (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-500 opacity-60" />
              ) : null}
              <span
                className={`relative inline-flex size-2.5 rounded-full ${
                  offline ? "bg-red-600" : "bg-brand-600"
                }`}
              />
            </span>
            {offline ? "Offline" : "Live"}
          </span>

          {me.role === "admin" ? (
            <label className="flex items-center gap-2 text-sm font-semibold text-ink-700">
              <span className="sr-only">Warehouse</span>
              <Icon name="pin" className="text-ink-500" />
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="h-10 rounded-lg border border-line bg-white px-2 text-sm font-bold text-ink-900"
              >
                {WAREHOUSES.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="hidden items-center gap-1.5 text-sm font-bold text-ink-700 lg:inline-flex">
              <Icon name="pin" className="text-ink-500" />
              {WAREHOUSES.find((w) => w.id === warehouseId)?.name ?? warehouseId}
            </span>
          )}

          <OrderAlerts />

          <span
            className="grid size-10 place-items-center rounded-full bg-surface text-sm font-extrabold text-ink-700"
            title={`${me.name}, ${me.role.replace("_", " ")}`}
            aria-label={`Signed in as ${me.name}`}
          >
            {initials(me.name)}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="grid size-10 place-items-center rounded-lg text-ink-500 transition hover:bg-surface hover:text-ink-900"
            aria-label="Sign out"
            title="Sign out"
          >
            <Icon name="logout" />
          </button>
        </div>
      </div>
    </header>
  );
}
