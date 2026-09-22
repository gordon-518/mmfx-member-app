import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The organic image renderer reads its .ttf files from disk at request time. Next
  // only traces files it can see referenced statically, and the path there is built with
  // path.join, so the fonts must be named explicitly or they are absent in production
  // and every render fails.
  outputFileTracingIncludes: {
    "/api/organic/render": ["./src/lib/organic/fonts/*.ttf"],
  },

  // Admin uploads a cover image + a PDF report in one server action — the
  // default 1MB body limit would silently drop real PDFs. Raise it.
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },

  // Public Supabase Storage (analysis cover images) served via next/image.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dldrcitoeoxzfctsqlmo.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

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
