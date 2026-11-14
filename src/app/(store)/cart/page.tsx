import type { Metadata } from "next";

import { ComingSoon } from "@/components/store/coming-soon";

export const metadata: Metadata = { title: "Bag" };

export default function CartPage() {
  return (
    <ComingSoon
      title="Your Bag"
      description="Bag and quantity management arrive in the next build. Ordering stays switched off until the order method (WhatsApp enquiry, COD request or catalogue-only) is confirmed. No online payments in Phase 1."
    />
  );
}
