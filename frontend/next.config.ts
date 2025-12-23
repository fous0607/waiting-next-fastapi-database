import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  async rewrites() {
    // In Render, API_URL should be http://waiting-backend:8000
    const isProd = process.env.NODE_ENV === "production";
    const defaultUrl = isProd ? "http://waiting-backend:8000" : "http://localhost:8088";

    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || defaultUrl;
    console.log(`[Next.js Rewrite] Redirecting /api to: ${apiUrl} (Note: Default for prod is http://waiting-backend:8000)`);
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
