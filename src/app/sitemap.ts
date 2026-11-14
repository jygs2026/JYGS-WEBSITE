import type { MetadataRoute } from "next";

import { collections } from "@/config/routes";
import { siteUrl } from "@/config/site";
import { getPublishedProducts, getVisibleCategories } from "@/services/catalog";

/** Published, indexable storefront pages. Filtered/search URLs are intentionally excluded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    getPublishedProducts(),
    getVisibleCategories(),
  ]);

  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/shop`, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({
      url: `${siteUrl}/category/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...Object.keys(collections).map((slug) => ({
      url: `${siteUrl}/collections/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: `${siteUrl}/product/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
