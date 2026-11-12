"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/orders", label: "Orders" },
  { href: "/catalog", label: "Catalog" },
  { href: "/banners", label: "Banners" },
  { href: "/inventory", label: "Inventory" },
  { href: "/warehouses", label: "Warehouses" },
  { href: "/riders", label: "Riders" },
  { href: "/customers", label: "Customers" },
  { href: "/team", label: "Team" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
  );
}
