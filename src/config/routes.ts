/**
 * Static slug-based routes. Shared by the pages (generateStaticParams / titles) and by
 * `src/proxy.ts`, which returns a real HTTP 404 for unknown slugs before rendering starts.
 */
export const collections = {
  "new-arrivals": "New Arrivals",
  "best-sellers": "Best Sellers",
} as const satisfies Record<string, string>;

/** Listing behaviour for each collection page. */
export const collectionDetails = {
  "new-arrivals": {
    description: "The latest JYGS oversized and boxy tees, newest first.",
    defaultSort: "newest",
  },
  "best-sellers": {
    description: "The JYGS tees customers come back for.",
    defaultSort: "featured",
  },
} as const satisfies Record<
  keyof typeof collections,
  { description: string; defaultSort: "featured" | "newest" }
>;

export const policies = {
  shipping: "Shipping Policy",
  returns: "Returns Policy",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
} as const satisfies Record<string, string>;

/** Own-property lookup, so inherited keys such as "constructor" never match. */
function lookup<T extends Record<string, string>>(map: T, slug: string): T[keyof T] | null {
  return Object.hasOwn(map, slug) ? map[slug as keyof T] : null;
}

export function getCollectionTitle(slug: string) {
  return lookup(collections, slug);
}

export function getPolicyTitle(slug: string) {
  return lookup(policies, slug);
}
