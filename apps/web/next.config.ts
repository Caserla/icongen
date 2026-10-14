import type { NextConfig } from "next";
import path from "node:path";

const isDevelopment = process.env.NODE_ENV === "development";
const appEnvironment = process.env.NEXT_PUBLIC_APP_ENV ?? (isDevelopment ? "development" : undefined);
const isIndexable = appEnvironment === "production";
const configuredSupabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.supabase.co ${configuredSupabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co ${configuredSupabaseOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDevelopment
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
  ...(isIndexable ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]),
];

const nextConfig: NextConfig = {
  output: process.env.EASY_ICON_LOCAL_MODE === "true" ? undefined : "standalone",
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  serverExternalPackages: ["pathkit-wasm"],
  outputFileTracingIncludes: {
    "/api/generation/svg-icon": ["../../node_modules/pathkit-wasm/bin/*", "node_modules/pathkit-wasm/bin/*"],
  },
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  transpilePackages: ["@icongen/shared"],
  experimental: { proxyClientMaxBodySize: "1mb" },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/images/icon-style-previews/web-512-v1/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
