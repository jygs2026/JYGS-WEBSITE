import type { Metadata } from "next";

import { ComingSoon } from "@/components/store/coming-soon";

export const metadata: Metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return (
    <ComingSoon
      title="Wishlist"
      description="Save your favourite pieces here. The wishlist arrives in the next build and is saved to your account once sign-in is available."
    />
  );
}
