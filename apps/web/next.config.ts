import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: "standalone",
  transpilePackages: ["@repo/ui"],
};

export default nextConfig;
