import type { Metadata } from "next";

import { CartView } from "@/components/store/cart/cart-view";
import { siteConfig } from "@/config/site";
import { getCartCatalog } from "@/services/catalog";

export const metadata: Metadata = {
  title: "Bag",
  // The bag is personal and stored in the browser: never indexed (in demo mode nothing is
  // followed either, matching the site-wide setting).
  robots: { index: false, follow: !siteConfig.demoMode },
};

/**
 * The bag (M3.3). The current catalogue is passed to the client, where the saved bag is read
 * from browser storage and joined with it. No checkout, order or payment exists in this phase.
 */
export default async function CartPage() {
  const catalog = await getCartCatalog();
  return <CartView catalog={catalog} />;
}
