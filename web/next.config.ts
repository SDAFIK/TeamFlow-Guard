import type { NextConfig } from "next";
const staticExport = process.env.STATIC_EXPORT === "true";
const config: NextConfig = {
  ...(staticExport ? { output: "export" as const } : {}),
  devIndicators: false,
  turbopack: { root: process.cwd() },
  async rewrites() {
    if (staticExport) return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },
  async headers() {
    if (staticExport) return [];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
if (staticExport) {
  delete config.rewrites;
  delete config.headers;
}
export default config;
