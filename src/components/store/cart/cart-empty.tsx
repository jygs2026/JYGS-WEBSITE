import type { Ref } from "react";

import { CtaLink } from "@/components/store/cta-link";

export function CartEmpty({ headingRef }: { headingRef: Ref<HTMLHeadingElement> }) {
  return (
    <section className="flex flex-col items-center py-16 text-center md:py-24" data-cart-empty>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-black tracking-tight uppercase outline-none md:text-3xl"
      >
        Your bag is empty
      </h2>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        Pick a colour and size on any product page and add it to your bag.
      </p>
      <div className="mt-8">
        <CtaLink href="/shop" variant="dark">
          Continue Shopping
        </CtaLink>
      </div>
    </section>
  );
}
