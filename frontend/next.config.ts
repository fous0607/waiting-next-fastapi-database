import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  async rewrites() {
    const apiUrl = process.env.API_URL || "http://localhost:8088";
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
