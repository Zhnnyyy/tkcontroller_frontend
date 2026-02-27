/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "local-origin.dev",
    "*.local-origin.dev",
    "192.168.0.10",
    "192.168.0.*",
  ],
};

module.exports = nextConfig;
