import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel's adapter emits its own server bundles; Docker needs standalone output.
  output: process.env.VERCEL ? undefined : "standalone",
  async headers() {
    return [{ source: "/account/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "no-store" }] }];
  },
};

export default nextConfig;
