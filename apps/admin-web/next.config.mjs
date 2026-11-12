import path from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

// The browser calls /api/... on this site and Next forwards it to the services, so no CORS setup is
// needed and the service ports stay private. In production the gateway replaces these targets.
const catalogUrl = process.env.CATALOG_SERVICE_URL ?? "http://localhost:4002";
const inventoryUrl = process.env.INVENTORY_SERVICE_URL ?? "http://localhost:4003";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@qc/ui-web"],
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: monorepoRoot,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${catalogUrl}/:path*` },
      { source: "/api-inventory/:path*", destination: `${inventoryUrl}/:path*` },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
