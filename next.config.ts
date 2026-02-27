import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "local-origin.dev",
    "*.local-origin.dev",
    "192.168.0.10",
    "192.168.0.*",
  ],
};

export default nextConfig;
