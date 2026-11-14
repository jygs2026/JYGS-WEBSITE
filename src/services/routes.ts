/**
 * Fast existence checks for slug-based storefront routes, used by `src/proxy.ts`.
 *
 * With Cache Components, a page's static shell is streamed with HTTP 200 before the page body
 * runs, so `notFound()` inside the page cannot change the status for slugs that were not
 * prerendered. Checking here — before rendering — lets the proxy return a real 404.
 *
 * In M5 the product/category checks become lightweight Supabase lookups (slug only).
 */
import { getCollectionTitle, getPolicyTitle } from "@/config/routes";

import { getCategoryBySlug, getPublishedProductBySlug } from "./catalog";

/**
 * The product's own colour slug for a requested `?colour=` value (case-insensitive), or null when
 * the value is invalid / not offered — in which case the default product page is served.
 */
export async function resolveRequestedColourSlug(
  productSlug: string,
  requested: string,
): Promise<string | null> {
  const product = await getPublishedProductBySlug(productSlug);
  const wanted = requested.trim().toLowerCase();
  if (!product || !wanted) return null;
  return product.variants.find((v) => v.isActive && v.colour.slug === wanted)?.colour.slug ?? null;
}

export async function slugRouteExists(section: string, slug: string): Promise<boolean> {
  switch (section) {
    case "product":
      return (await getPublishedProductBySlug(slug)) !== null;
    case "category":
      return (await getCategoryBySlug(slug)) !== null;
    case "collections":
      return getCollectionTitle(slug) !== null;
    case "policies":
      return getPolicyTitle(slug) !== null;
    default:
      return true;
  }
}
