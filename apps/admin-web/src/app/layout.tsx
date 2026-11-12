import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nav } from "../components/nav";
import { Providers } from "../lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "QC Admin",
  description: "Platform admin",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 border-r border-line bg-white p-4">
            <div className="mb-6 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-brand-600 font-extrabold text-ink-900">
                Q
              </span>
              <span className="text-base font-extrabold">QC Admin</span>
            </div>
            <Nav />
          </aside>
          <main className="min-w-0 flex-1 p-8">
            <Providers>{children}</Providers>
          </main>
        </div>
      </body>
    </html>
  );
}
