/**
 * Static site-level configuration.
 *
 * Anything the owner should be able to change without a code edit (contact details,
 * social links, announcement text, policies) moves to the `store_settings` table in M4/M5.
 * Values marked PLACEHOLDER are awaiting owner input (brief §15).
 */
export const siteConfig = {
  name: "JYGS Clothing",
  shortName: "JYGS",
  tagline: "Premium Unisex Streetwear",
  description:
    "JYGS Clothing — premium unisex streetwear. Oversized fits, premium cotton essentials and distinctive back graphics for Men, Women and Unisex.",
  locale: "en-IN",
  currency: "INR",
  /**
   * Order completion method — deliberately undecided (brief §2, §4, Phase 6).
   * Until the owner chooses WhatsApp enquiry / COD request / catalogue-only,
   * the cart must not expose a "Place Order" action. No payment gateway in Phase 1.
   */
  orderMode: "deferred",
} as const satisfies {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  locale: string;
  currency: "INR";
  orderMode: OrderMode;
};

export type OrderMode = "deferred" | "catalogue" | "whatsapp" | "cod";

/** Primary storefront navigation. Category slugs will come from the database in M5. */
export const mainNav = [
  { label: "Men", href: "/category/men" },
  { label: "Women", href: "/category/women" },
  { label: "Unisex", href: "/category/unisex" },
  { label: "New Arrivals", href: "/collections/new-arrivals" },
  { label: "Best Sellers", href: "/collections/best-sellers" },
] as const;
