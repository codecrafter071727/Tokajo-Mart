"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Nav } from "./nav";

/** The sidebar and page frame. The sign in page stands alone. */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/login") return <>{children}</>;

  const signOut = async () => {
    await fetch("/session/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-white p-4">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 font-extrabold text-ink-900">
            Q
          </span>
          <span className="text-base font-extrabold">QC Admin</span>
        </div>
        <Nav />
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-auto rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-700 hover:bg-surface"
        >
          Sign out
        </button>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
