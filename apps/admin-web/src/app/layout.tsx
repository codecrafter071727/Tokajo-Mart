import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AdminShell } from "../components/shell/AdminShell";
import { WAREHOUSE_COOKIE } from "../lib/warehouse-cookie";
import { Providers } from "../lib/providers";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

/** Sets the dark class before first paint from the saved choice, so a page never flashes the wrong theme. */
const THEME_SCRIPT = `try{var t=localStorage.getItem("qc-admin-theme")||"light";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}`;

export const metadata: Metadata = {
  title: { default: "Milcki admin", template: "%s · Milcki admin" },
  description: "Run every warehouse, rider and order",
  robots: { index: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const warehouse = (await cookies()).get(WAREHOUSE_COOKIE)?.value ?? "";
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased`}>
        <Providers>
          <AdminShell initialWarehouse={decodeURIComponent(warehouse)}>{children}</AdminShell>
        </Providers>
      </body>
    </html>
  );
}
