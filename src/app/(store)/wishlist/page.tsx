import type { Metadata } from "next";

import { WishlistView } from "@/components/store/wishlist/wishlist-view";
import { siteConfig } from "@/config/site";
import { getCartCatalog } from "@/services/catalog";

export const metadata: Metadata = {
  title: "Wishlist",
  // Personal and stored in the browser: never indexed (nothing followed in demo mode).
  robots: { index: false, follow: !siteConfig.demoMode },
};

/**
 * The wishlist (M3.4). The current catalogue is passed to the client, where the saved wishlist
 * is read from browser storage and joined with it. No account, checkout or payment in this phase.
 */
export default async function WishlistPage() {
  const catalog = await getCartCatalog();
  return <WishlistView catalog={catalog} />;
}
