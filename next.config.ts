import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Template uploads go through a server action; contracts can be a few MB.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
