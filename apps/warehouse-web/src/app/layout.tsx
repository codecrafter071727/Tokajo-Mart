import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorker } from "../components/service-worker";
import { Providers } from "../lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Milcki Warehouse",
  description: "Warehouse pick, pack and handover",
  applicationName: "Milcki Warehouse",
  manifest: "/manifest.webmanifest",
  // Tab icon: src/app/favicon.ico + icon.png (see scripts/generate-milcki-icons.mjs)
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Milcki Warehouse", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#42C86E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
