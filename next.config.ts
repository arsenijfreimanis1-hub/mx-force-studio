import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["three"],
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
