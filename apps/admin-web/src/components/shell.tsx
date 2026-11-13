"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "./icons";
import { Nav } from "./nav";

type Me = { name: string; email: string | null; role: string };

export function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`grid place-items-center rounded-lg bg-brand-600 font-black text-ink-900 shadow-[inset_0_-2px_0_rgb(0_0_0/0.1)] ${
          size === "lg" ? "size-10 text-lg" : "size-8 text-base"
        }`}
        aria-hidden="true"
      >
        t
      </span>
      <span className="leading-tight">
        <span
          className={`block font-bold tracking-tight ${size === "lg" ? "text-lg" : "text-[15px]"}`}
        >
          Tokajo
        </span>
        <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-500">
          Admin console
        </span>
      </span>
    </span>
  );
}

/** The sidebar and page frame. The sign in page stands alone. */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const standalone = pathname === "/login";
  const me = useQuery({
    queryKey: ["me"],
    enabled: !standalone,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Me | null> => {
      const res = await fetch("/api/v1/identity/me");
      return res.ok ? ((await res.json()) as Me) : null;
    },
  });
  if (standalone) return <>{children}</>;

  const signOut = async () => {
    await fetch("/session/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  const name = me.data?.name ?? "Admin";
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-line bg-white xl:w-60">
        <div className="flex h-16 items-center border-b border-line px-5">
          <BrandMark />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <Nav />
        </div>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 text-xs font-semibold text-white"
              aria-hidden="true"
            >
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{name}</span>
              <span className="block truncate text-xs text-ink-500">
                {me.data?.email ?? "Platform admin"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Sign out"
              title="Sign out"
              className="grid size-8 place-items-center rounded-lg text-ink-500 hover:bg-surface hover:text-ink-900"
            >
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1400px] px-5 py-7 xl:px-10">{children}</div>
      </main>
    </div>
  );
}
