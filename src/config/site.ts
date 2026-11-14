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
  tagline: "Premium Oversized T-Shirts",
  description:
    "JYGS Clothing — premium oversized T-shirts. Heavyweight cotton essentials with minimal fronts and distinctive back graphics, for Men, Women and Unisex.",
  locale: "en-IN",
  currency: "INR",
  /**
   * Order completion method — deliberately undecided (brief §2, §4, Phase 6).
   * Until the owner chooses WhatsApp enquiry / COD request / catalogue-only,
   * the cart must not expose a "Place Order" action. No payment gateway in Phase 1.
   */
  orderMode: "deferred",
  /**
   * While true, the storefront clearly labels all products, prices, stock and imagery as
   * demo placeholders. Switch off only once the owner's real catalogue is live.
   */
  demoMode: true,
  copyrightYear: 2026,
} as const satisfies {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  locale: string;
  currency: "INR";
  orderMode: OrderMode;
  demoMode: boolean;
  copyrightYear: number;
};

export type OrderMode = "deferred" | "catalogue" | "whatsapp" | "cod";

/**
 * Absolute site origin used for canonical URLs, the sitemap and Open Graph.
 * Set NEXT_PUBLIC_SITE_URL to the production domain when deploying.
 */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);

export interface NavLink {
  label: string;
  href: string;
}

/** Primary storefront navigation. Category slugs will come from the database in M5. */
export const mainNav: NavLink[] = [
  { label: "Men", href: "/category/men" },
  { label: "Women", href: "/category/women" },
  { label: "Unisex", href: "/category/unisex" },
  { label: "New Arrivals", href: "/collections/new-arrivals" },
  { label: "Best Sellers", href: "/collections/best-sellers" },
];

/** Secondary links shown in the mobile menu. */
export const secondaryNav: NavLink[] = [
  { label: "Shop All", href: "/shop" },
  { label: "Account", href: "/account" },
  { label: "Wishlist", href: "/wishlist" },
  { label: "About JYGS", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Shop",
    links: [
      { label: "Shop All", href: "/shop" },
      { label: "Men", href: "/category/men" },
      { label: "Women", href: "/category/women" },
      { label: "Unisex", href: "/category/unisex" },
      { label: "New Arrivals", href: "/collections/new-arrivals" },
      { label: "Best Sellers", href: "/collections/best-sellers" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
      { label: "Shipping", href: "/policies/shipping" },
      { label: "Returns", href: "/policies/returns" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About JYGS", href: "/about" },
      { label: "Privacy Policy", href: "/policies/privacy" },
      { label: "Terms of Service", href: "/policies/terms" },
    ],
  },
];
