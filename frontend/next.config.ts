import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  async rewrites() {
    // In Render, API_URL is set to http://waiting-backend:8000
    // If running locally, we fallback to localhost:8088
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8088";
    console.log(`[Next.js Rewrite] Redirecting /api to: ${apiUrl}`);
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: "/dashboard",
        destination: `${apiUrl}/dashboard`,
      },
      {
        source: "/admin",
        destination: `${apiUrl}/admin`,
      },
      {
        source: "/superadmin",
        destination: `${apiUrl}/superadmin`,
      },
      {
        source: "/static/:path*",
        destination: `${apiUrl}/static/:path*`,
      },
    ];
  },
};

export default nextConfig;
