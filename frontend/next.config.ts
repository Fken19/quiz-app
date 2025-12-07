import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Temporarily ignore ESLint and TypeScript build errors inside Docker
  // so CI/development images can still produce `.next` artifacts.
  eslint: {
    // Don't fail production builds due to linting issues
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow building even if there are TS type errors (temporary)
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8080",
        pathname: "/media/**",
      },
      {
        protocol: "https",
        hostname: "quiz-backend-974259457412.asia-northeast1.run.app",
        pathname: "/media/**",
      },
    ],
  },
};

export default nextConfig;
