"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

const GROUPS: { label: string; items: { href: string; label: string; icon: IconName }[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/orders", label: "Orders", icon: "orders" },
    ],
  },
  {
    label: "Storefront",
    items: [
      { href: "/catalog", label: "Catalog", icon: "catalog" },
      { href: "/banners", label: "Banners", icon: "banners" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/inventory", label: "Inventory", icon: "inventory" },
      { href: "/warehouses", label: "Warehouses", icon: "warehouses" },
      { href: "/riders", label: "Riders", icon: "riders" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/customers", label: "Customers", icon: "customers" },
      { href: "/team", label: "Team", icon: "team" },
    ],
  },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-300">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors ${
                      active
                        ? "bg-brand-50 text-brand-900"
                        : "text-ink-700 hover:bg-surface hover:text-ink-900"
                    }`}
                  >
                    {active ? (
                      <span
                        className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-600"
                        aria-hidden="true"
                      />
                    ) : null}
                    <Icon
                      name={item.icon}
                      size={18}
                      className={active ? "text-brand-700" : "text-ink-500"}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
