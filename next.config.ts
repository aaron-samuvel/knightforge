import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
