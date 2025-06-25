import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Warning: This disables ESLint checks during builds
    // Only use temporarily for deployment - fix the ESLint issues afterward
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
