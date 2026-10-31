import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The sandbox preview panel serves the app from *.space-z.ai while the dev
  // server runs on localhost. Without this, Next.js logs a cross-origin
  // warning for every /_next/* asset request and the dev-tools indicator
  // shows it as an issue badge.
  allowedDevOrigins: ["*.space-z.ai"],
  // socket.io runs inside the Next.js Node process (see src/instrumentation.ts)
  serverExternalPackages: ["socket.io"],
  // Portability: on single-port hosts (Render, Railway, Fly, plain Docker
  // without the sandbox Caddy gateway) the embedded realtime server on :3003
  // must be reachable through the web port itself. Proxing /socket.io through
  // Next keeps the client same-origin everywhere. In the sandbox the Caddy
  // gateway shortcuts `?XTransformPort=3003` directly to :3003, so those
  // requests never reach this rewrite — both paths work.
  async rewrites() {
    return [
      {
        source: "/socket.io/:path*",
        destination: "http://127.0.0.1:3003/socket.io/:path*",
      },
    ]
  },
  // Baseline hardening headers for every response.
  // (No strict CSP — the app relies on inline styles/scripts from Next.js;
  // add a nonce-based CSP only after a full audit.)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ]
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
