import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App-wide security headers. The member app is never meant to be embedded
  // by third parties — deny framing to prevent clickjacking of the
  // authenticated UI. (This app frames Gumlet, not the other way around, so
  // SAMEORIGIN does not affect the course player.)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
