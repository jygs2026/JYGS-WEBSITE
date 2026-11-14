import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // TEMPORARY: free stock photography used as placeholders until the owner supplies
      // real campaign/product photos. Remove once all imagery is served from Supabase Storage.
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      // Supabase Storage (product + campaign images) is added in M4 once the project URL exists.
    ],
  },
  async redirects() {
    // Product search lives on the shop page (`/shop?q=`); the query string is passed through.
    return [{ source: "/search", destination: "/shop", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
