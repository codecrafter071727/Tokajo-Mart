import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorker } from "../components/service-worker";
import { Providers } from "../lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tokajo Warehouse",
  description: "Warehouse pick, pack and handover",
  applicationName: "Tokajo Warehouse",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Warehouse", statusBarStyle: "default" },
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
