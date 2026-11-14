import type { MetadataRoute } from "next";

import { siteConfig, siteUrl } from "@/config/site";

/** While in demo mode the whole site is excluded from crawling (placeholder content). */
export default function robots(): MetadataRoute.Robots {
  if (siteConfig.demoMode) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/cart", "/account"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
