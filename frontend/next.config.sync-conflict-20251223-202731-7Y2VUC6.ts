import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8088/api/:path*",
      },
      {
        source: "/dashboard",
        destination: "http://localhost:8088/dashboard",
      },
      {
        source: "/admin",
        destination: "http://localhost:8088/admin",
      },
      {
        source: "/superadmin",
        destination: "http://localhost:8088/superadmin",
      },
      {
        source: "/static/:path*",
        destination: "http://localhost:8088/static/:path*",
      },
    ];
  },
};

export default nextConfig;
