"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Avatar, Logo } from "@/components/ui/brand";
import { cn } from "@/components/ui/core";
import {
  Bell,
  Bike,
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  Percent,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  ShieldCheck,
  ShoppingBag,
  Tag,
  TrendingUp,
  Users,
  Warehouse,
  X,
  type IconComponent,
} from "@/components/ui/icons";
import { useAttention } from "../../lib/attention";
import { AlertsBell } from "./AlertsBell";
import { CommandPalette, SearchTrigger, useCommandPalette } from "./CommandPalette";
import { NavProgress } from "./NavProgress";
import { ThemeToggle } from "./ThemeToggle";
import { useWarehouse, WarehouseProvider } from "./warehouse-context";

type Me = { name: string; email: string | null; role: string };
type NavItem = { href: string; label: string; icon: IconComponent };

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Run",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/reports", label: "Reports", icon: TrendingUp },
      { href: "/orders", label: "Live orders", icon: ShoppingBag },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/payments", label: "Payments", icon: CreditCard },
      { href: "/promotions", label: "Promotions", icon: Percent },
    ],
  },
  {
    label: "Storefront",
    items: [
      { href: "/catalog", label: "Catalog", icon: Tag },
      { href: "/banners", label: "Banners", icon: Megaphone },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/inventory", label: "Inventory", icon: Boxes },
      { href: "/warehouses", label: "Warehouses", icon: Warehouse },
      { href: "/riders", label: "Riders", icon: Bike },
    ],
  },
  {
    label: "Admin",
    items: [{ href: "/team", label: "Team", icon: ShieldCheck }],
  },
];
const ALL_ITEMS = GROUPS.flatMap((g) => g.items);
const SIDEBAR_KEY = "qc-admin-sidebar";

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/**
 * The frame around every admin page, after the Booking Hub: a fixed sidebar that collapses to
 * icons (the choice is kept), a warehouse switcher where the hub has its site switcher, a sticky
 * top bar with the section title, search, theme, alerts and the person, and a drawer on a phone.
 * The sign in page stands alone.
 */
export function AdminShell({
  initialWarehouse,
  children,
}: {
  initialWarehouse: string;
  children: ReactNode;
}) {
  const path = usePathname();
  const standalone = path === "/login";
  if (standalone) return <>{children}</>;
  return (
    <WarehouseProvider initial={initialWarehouse} enabled>
      <Frame>{children}</Frame>
    </WarehouseProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const me = useQuery({
    queryKey: ["me"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Me | null> => {
      const res = await fetch("/api/v1/identity/me");
      return res.ok ? ((await res.json()) as Me) : null;
    },
  });
  const attention = useAttention();
  const palette = useCommandPalette();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "collapsed");
    } catch {
      /* not kept */
    }
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, c ? "open" : "collapsed");
      } catch {
        /* not kept */
      }
      return !c;
    });

  const signOut = async () => {
    await fetch("/session/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  const current =
    ALL_ITEMS.find((n) => isActive(path, n.href))?.label ??
    (path.startsWith("/styleguide") ? "Style guide" : "Admin");
  const name = me.data?.name ?? "Admin";
  const role = me.data?.role?.replace(/_/g, " ") ?? "admin";
  const alerts = attention.items.length;

  const sidebar = (narrow: boolean) => (
    <div className="flex h-full flex-col border-r border-nav-line bg-nav text-nav-text">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-nav-line",
          narrow ? "justify-center" : "gap-3 px-4",
        )}
      >
        <Logo height={34} />
        {!narrow && (
          <span className="min-w-0 leading-tight">
            <span className="block text-lg font-semibold whitespace-nowrap text-nav-ink">
              Milcki
            </span>
            <span className="block text-[11px] font-medium tracking-wide text-nav-text uppercase">
              Admin console
            </span>
          </span>
        )}
      </div>

      <div className="px-3 pt-3">
        <WarehouseSwitcher narrow={narrow} onPick={() => setOpen(false)} />
      </div>

      <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {GROUPS.map((group) => (
          <div key={group.label}>
            {!narrow && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-nav-text/80 uppercase">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((n) => {
                const on = isActive(path, n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    aria-current={on ? "page" : undefined}
                    title={narrow ? n.label : undefined}
                    className={cn(
                      "group relative flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                      narrow ? "justify-center px-0" : "gap-3 px-3",
                      on ? "bg-nav-active text-nav-ink" : "hover:bg-nav-hover hover:text-nav-ink",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent transition-opacity",
                        on ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    />
                    <n.icon
                      className={cn(
                        "size-5 shrink-0 transition-transform",
                        on ? "text-accent" : "group-hover:scale-110",
                      )}
                    />
                    {!narrow && n.label}
                    {!narrow && n.href === "/dashboard" && alerts > 0 && (
                      <span className="tnum ml-auto rounded-full bg-warn-soft px-1.5 text-[11px] font-semibold text-warn ring-1 ring-warn-line">
                        {alerts}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-nav-line p-3">
        <div className={cn("flex items-center", narrow ? "flex-col gap-2" : "gap-2.5 px-1.5 py-1")}>
          <Avatar name={name} size={32} title={name} />
          {!narrow && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-nav-ink">{name}</div>
              <div className="truncate text-xs text-nav-text capitalize">{role}</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-lg p-1.5 text-nav-text transition-colors hover:bg-nav-hover hover:text-nav-ink"
          >
            <LogOut className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="hidden w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-nav-text transition-colors hover:bg-nav-hover hover:text-nav-ink lg:flex"
          aria-label={narrow ? "Expand the sidebar" : "Collapse the sidebar"}
        >
          {narrow ? (
            <ChevronRight className="size-5" />
          ) : (
            <>
              <ChevronLeft className="size-5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-300 ease-out lg:block",
          collapsed ? "w-[72px]" : "w-[260px]",
        )}
      >
        {sidebar(collapsed)}
      </aside>

      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col transition-[padding] duration-300 ease-out",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]",
        )}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-canvas/80 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-2 lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <p className="truncate text-xl font-semibold text-ink">{current}</p>
            <WarehouseLabel />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <SearchTrigger onOpen={() => palette.setOpen(true)} />
            <ThemeToggle />
            <AlertsBell />
            <Avatar name={name} size={36} title={`${name} (${role})`} />
          </div>
        </header>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-[var(--scrim)]"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-y-0 left-0 w-[260px] shadow-pop">
              {sidebar(false)}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="absolute top-4 right-3 rounded-lg p-1.5 text-nav-text hover:bg-nav-hover hover:text-nav-ink"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1320px] min-w-0 flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
        {palette.open ? <CommandPalette onClose={() => palette.setOpen(false)} /> : null}
      </div>
    </div>
  );
}

function WarehouseLabel() {
  const { warehouseId, nameOf } = useWarehouse();
  return (
    <span className="hidden truncate text-sm text-muted md:inline">
      {warehouseId ? nameOf(warehouseId) : "All warehouses"}
    </span>
  );
}

const initials = (s: string) =>
  s
    .split(/[\s@.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Where the hub switches between sites, the console switches the warehouse every page looks at. */
function WarehouseSwitcher({ narrow, onPick }: { narrow: boolean; onPick: () => void }) {
  const { warehouseId, warehouses, setWarehouseId, nameOf } = useWarehouse();
  const [open, setOpen] = useState(false);
  const label = warehouseId ? nameOf(warehouseId) : "All warehouses";
  const chosen = warehouses.find((w) => w.id === warehouseId);
  const detail = warehouseId
    ? chosen
      ? chosen.open
        ? "Open now"
        : "Closed"
      : warehouseId
    : `${warehouses.length} warehouses`;
  const options = [{ id: "", name: "All warehouses", open: true }, ...warehouses];

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={narrow ? label : undefined}
        className={cn(
          "flex w-full items-center rounded-lg border border-nav-line bg-nav-hover text-left transition-colors hover:bg-nav-active",
          narrow ? "justify-center p-1.5" : "gap-2.5 px-2.5 py-2",
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-nav-active text-[11px] font-semibold text-nav-ink">
          {warehouseId ? initials(label) : <Warehouse className="size-3.5" />}
        </span>
        {!narrow && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-nav-ink">{label}</span>
              <span className="block truncate text-xs text-nav-text">{detail}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-nav-text" />
          </>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <ul
            role="listbox"
            aria-label="Warehouse"
            className={cn(
              "absolute top-full z-20 mt-1 overflow-hidden rounded-lg border border-nav-line bg-nav py-1 shadow-pop",
              narrow ? "left-0 w-60" : "inset-x-0",
            )}
          >
            {options.map((w) => {
              const on = w.id === warehouseId;
              return (
                <li key={w.id || "all"}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      setWarehouseId(w.id);
                      setOpen(false);
                      onPick();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-nav-hover",
                      on ? "text-nav-ink" : "text-nav-text",
                    )}
                  >
                    <span className="flex size-6 items-center justify-center rounded bg-nav-active text-[10px] font-semibold text-nav-ink">
                      {w.id ? initials(w.name) : <Warehouse className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{w.name}</span>
                    {w.id && !w.open && (
                      <span className="text-[11px] font-medium text-bad">Closed</span>
                    )}
                    {on && <Check className="size-4 text-accent" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
