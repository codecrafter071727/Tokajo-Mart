import type { ReactNode } from "react";
import { Nav } from "../../components/nav";
import { WarehouseProvider } from "../../lib/providers";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <WarehouseProvider>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 h-screen w-56 shrink-0 border-r border-line bg-white p-4">
          <div className="mb-6 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-600 font-extrabold text-ink-900">
              Q
            </span>
            <span className="text-base font-extrabold">QC Warehouse</span>
          </div>
          <Nav />
        </aside>
        <main className="min-w-0 flex-1 p-8">{children}</main>
      </div>
    </WarehouseProvider>
  );
}
