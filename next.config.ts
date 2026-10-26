import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // socket.io runs inside the Next.js Node process (see src/instrumentation.ts)
  serverExternalPackages: ["socket.io"],
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
