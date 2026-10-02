import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There's an unrelated package-lock.json in the parent folder; pin the project root.
  turbopack: { root: __dirname },
};

export default nextConfig;
