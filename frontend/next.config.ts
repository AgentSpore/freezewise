import type { NextConfig } from "next";

// Note: /api/* requests are handled by the catch-all route handler at
// app/api/[...path]/route.ts which proxies to BACKEND_URL with long timeout
// for slow AI endpoints. No rewrites needed.

const nextConfig: NextConfig = {};

export default nextConfig;
