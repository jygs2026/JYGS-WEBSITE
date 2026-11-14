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
