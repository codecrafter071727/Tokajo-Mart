"use client";

import type { AdminOrder, AdminProduct, AdminUser } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { rupees } from "../../lib/api";
import { gw, qs } from "../../lib/gw";
import { ORDER_STATUS } from "../../lib/order-status";
import { useDebounced } from "../../lib/users";
import { Avatar } from "../ui/brand";
import { Badge, cn } from "../ui/core";
import {
  ArrowRight,
  Bike,
  Boxes,
  CreditCard,
  LayoutDashboard,
  Loader2,
  Megaphone,
  Search,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Users,
  Warehouse,
  type IconComponent,
} from "../ui/icons";

type Result = {
  id: string;
  group: string;
  title: string;
  detail?: string;
  href: string;
  icon?: IconComponent;
  lead?: ReactNode;
  trail?: ReactNode;
};

const PAGES: { label: string; href: string; icon: IconComponent; words: string }[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, words: "dashboard home stats" },
  { label: "Live orders", href: "/orders", icon: ShoppingBag, words: "orders queue" },
  { label: "Payments", href: "/payments", icon: CreditCard, words: "razorpay refunds money" },
  { label: "Customers", href: "/customers", icon: Users, words: "people users" },
  { label: "Catalog", href: "/catalog", icon: Tag, words: "products categories" },
  { label: "Banners", href: "/banners", icon: Megaphone, words: "home offers" },
  { label: "Inventory", href: "/inventory", icon: Boxes, words: "stock grn" },
  { label: "Warehouses", href: "/warehouses", icon: Warehouse, words: "stores dark" },
  { label: "Riders", href: "/riders", icon: Bike, words: "delivery partners" },
  { label: "Team", href: "/team", icon: ShieldCheck, words: "staff admins" },
];

/** Opens with Ctrl K or Cmd K from anywhere in the console. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

/** The button in the top bar that looks like a search box and opens the palette. */
export function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search orders, customers, products and pages"
      className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm text-muted transition-colors hover:border-line-strong hover:text-ink sm:w-64"
    >
      <Search className="size-4 shrink-0" />
      <span className="hidden flex-1 text-left sm:inline">Search everything</span>
      <kbd className="hidden rounded border border-line bg-surface px-1.5 font-mono text-[11px] text-muted sm:inline">
        {mac ? "⌘" : "Ctrl"} K
      </kbd>
    </button>
  );
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const q = useDebounced(text.trim(), 200);
  const searching = q.length >= 2;

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    input.current?.focus();
  }, []);

  const orders = useQuery({
    queryKey: ["palette-orders", q],
    enabled: searching,
    queryFn: () => gw<{ items: AdminOrder[] }>("GET", `/v1/orders/admin${qs({ q, limit: 5 })}`),
  });
  const customers = useQuery({
    queryKey: ["palette-customers", q],
    enabled: searching,
    queryFn: () =>
      gw<{ items: AdminUser[] }>(
        "GET",
        `/v1/identity/admin/users${qs({ role: "customer", q, limit: 5 })}`,
      ),
  });
  const products = useQuery({
    queryKey: ["palette-products", q],
    enabled: searching,
    queryFn: () =>
      gw<{ items: AdminProduct[] }>("GET", `/v1/catalog/admin/products${qs({ q, limit: 5 })}`),
  });

  const results = useMemo<Result[]>(() => {
    const needle = text.trim().toLowerCase();
    const pages = PAGES.filter(
      (p) => !needle || p.label.toLowerCase().includes(needle) || p.words.includes(needle),
    ).slice(0, needle ? 4 : 10);
    const out: Result[] = pages.map((p) => ({
      id: `page:${p.href}`,
      group: "Go to",
      title: p.label,
      href: p.href,
      icon: p.icon,
    }));
    if (!searching) return out;
    for (const o of orders.data?.items ?? []) {
      const s = ORDER_STATUS[o.status];
      out.push({
        id: `order:${o.id}`,
        group: "Orders",
        title: o.number,
        detail: `${o.customerName || "Customer"} · ${rupees(o.totalPaise)}`,
        href: `/orders/${o.id}`,
        icon: ShoppingBag,
        trail: <Badge tone={s.tone}>{s.label}</Badge>,
      });
    }
    for (const c of customers.data?.items ?? []) {
      out.push({
        id: `customer:${c.id}`,
        group: "Customers",
        title: c.name || "No name yet",
        detail: c.phone ?? undefined,
        href: `/customers/${c.id}`,
        lead: <Avatar name={c.name || "Customer"} size={28} />,
        trail: c.status === "blocked" ? <Badge tone="bad">Blocked</Badge> : undefined,
      });
    }
    for (const p of products.data?.items ?? []) {
      out.push({
        id: `product:${p.id}`,
        group: "Products",
        title: p.name,
        detail: `${p.unit} · ${rupees(p.pricePaise)}`,
        href: `/catalog/products/${encodeURIComponent(p.id)}`,
        lead: (
          <span className="flex size-7 items-center justify-center overflow-hidden rounded-md bg-surface-2 ring-1 ring-line">
            {p.imageUrl ? (
              <img src={p.imageUrl} alt="" className="size-full object-contain" />
            ) : (
              <span aria-hidden>{p.emoji || "📦"}</span>
            )}
          </span>
        ),
        trail: p.archived ? <Badge>Archived</Badge> : undefined,
      });
    }
    return out;
  }, [text, searching, orders.data, customers.data, products.data]);

  useEffect(() => setActive(0), [results.length, q]);

  const go = (r: Result | undefined) => {
    if (!r) return;
    dialog.current?.close();
    router.push(r.href);
  };
  const loading = searching && (orders.isFetching || customers.isFetching || products.isFetching);
  const empty = searching && !loading && results.every((r) => r.group === "Go to");

  let lastGroup = "";
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close();
      }}
      aria-label="Search"
      className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-xl border border-line bg-surface p-0 text-ink shadow-pop"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        {loading ? (
          <Loader2 className="size-4 animate-spin text-muted" />
        ) : (
          <Search className="size-4 text-muted" />
        )}
        <input
          ref={input}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((i) => Math.min(results.length - 1, i + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              go(results[active]);
            }
          }}
          role="combobox"
          aria-expanded
          aria-controls="palette-results"
          aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
          placeholder="Search order numbers, customers, products"
          className="h-14 flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none focus-visible:outline-none"
        />
        <kbd className="rounded border border-line px-1.5 font-mono text-[11px] text-muted">
          Esc
        </kbd>
      </div>
      <ul id="palette-results" role="listbox" className="max-h-[60vh] overflow-y-auto py-2">
        {results.map((r, i) => {
          const heading = r.group !== lastGroup ? r.group : null;
          lastGroup = r.group;
          const Icon = r.icon;
          return (
            <li key={r.id} role="presentation">
              {heading ? (
                <div className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                  {heading}
                </div>
              ) : null}
              <button
                id={`palette-${r.id}`}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2 text-left text-sm",
                  i === active ? "bg-accent-soft" : "hover:bg-surface-2",
                )}
              >
                {r.lead ??
                  (Icon ? (
                    <Icon className={cn("size-4", i === active ? "text-accent" : "text-muted")} />
                  ) : null)}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink tnum">{r.title}</span>
                  {r.detail ? (
                    <span className="block truncate text-xs text-muted tnum">{r.detail}</span>
                  ) : null}
                </span>
                {r.trail}
                {i === active ? <ArrowRight className="size-4 text-accent" /> : null}
              </button>
            </li>
          );
        })}
        {empty ? (
          <li className="px-4 py-6 text-center text-[13px] text-muted">Nothing matches “{q}”.</li>
        ) : null}
        {!searching && text.trim().length === 1 ? (
          <li className="px-4 py-2 text-xs text-muted">Type one more letter to search.</li>
        ) : null}
      </ul>
      <div className="flex items-center gap-4 border-t border-line bg-surface-2/60 px-4 py-2 text-[11px] text-muted">
        <span>
          <kbd className="font-mono">↑ ↓</kbd> to move
        </span>
        <span>
          <kbd className="font-mono">Enter</kbd> to open
        </span>
      </div>
    </dialog>
  );
}
