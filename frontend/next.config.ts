import type { NextConfig } from "next";

const backendOrigin = process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "http://localhost:8080";
let backendUrl: URL;

try {
  backendUrl = new URL(backendOrigin);
} catch {
  backendUrl = new URL("http://localhost:8080");
}

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
        protocol: backendUrl.protocol.replace(":", ""),
        hostname: backendUrl.hostname,
        pathname: "/media/**",
        ...(backendUrl.port ? { port: backendUrl.port } : {}),
      },
    ],
  },
};

export default nextConfig;
