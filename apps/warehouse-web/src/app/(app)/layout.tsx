import type { ReactNode } from "react";
import { TopBar } from "../../components/nav";
import { WarehouseProvider } from "../../lib/providers";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <WarehouseProvider>
      <div className="min-h-screen">
        <TopBar />
        <main className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6">{children}</main>
      </div>
    </WarehouseProvider>
  );
}
