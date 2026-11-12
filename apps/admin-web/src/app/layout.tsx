import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Shell } from "../components/shell";
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
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
