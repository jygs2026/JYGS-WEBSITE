import type { Ref } from "react";

import { CtaLink } from "@/components/store/cta-link";

export function WishlistEmpty({ headingRef }: { headingRef: Ref<HTMLHeadingElement> }) {
  return (
    <section className="flex flex-col items-center py-16 text-center md:py-24" data-wishlist-empty>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-black tracking-tight uppercase outline-none md:text-3xl"
      >
        Your wishlist is empty
      </h2>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        Tap the heart on any product in the shop to save it here.
      </p>
      <div className="mt-8">
        <CtaLink href="/shop" variant="dark">
          Continue Shopping
        </CtaLink>
      </div>
    </section>
  );
}
