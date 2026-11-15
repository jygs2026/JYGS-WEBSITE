"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { StorageNotice } from "@/components/store/storage-notice";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { addToBagMessage, limitMessage, type Feedback } from "@/lib/cart/cart-feedback";
import { findLine, lineLimit } from "@/lib/cart/cart-model";
import { findVariant, getVariantAvailability } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { ProductWithDetails, SizeLabel } from "@/types";

/**
 * Add to Bag for the selected colour + size. The variant is resolved by its stable ID from the
 * catalogue; quantity is limited to min(10, demo stock). No checkout/payment happens here.
 * Re-mount (via `key`) when the selected variant changes so feedback resets.
 */
export function AddToBag({
  product,
  colourId,
  size,
  onMissingSize,
}: {
  product: ProductWithDetails;
  colourId: string | null;
  size: SizeLabel | null;
  /** Called when the customer tries to add without choosing a size. */
  onMissingSize: () => void;
}) {
  const cart = useCart();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const inFlight = useRef(false);

  const variant = findVariant(product, colourId, size);
  const availability = getVariantAvailability(product, variant);
  const inBag = variant ? (findLine(cart.data, variant.id)?.quantity ?? 0) : 0;
  const limit = lineLimit(availability);
  // Only known once the stored cart has been read (after hydration).
  const limitInfo = cart.ready && variant ? limitMessage(inBag, limit) : null;
  const atLimit = limitInfo !== null;

  async function add() {
    // The button is aria-disabled (not `disabled`) so keyboard focus stays on it: clicks while
    // adding or at the limit must be ignored here.
    if (pending || atLimit) return;
    if (!size) {
      setFeedback(null);
      onMissingSize();
      return;
    }
    // A second click arriving before React re-renders (a fast double-click) is ignored by this
    // synchronous guard.
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      const result = await cart.add(availability, 1);
      setFeedback(addToBagMessage(result, cart.isPersisted()));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  // After a successful add that reaches the limit, show the success message (it includes the
  // View Bag link) rather than repeating the limit explanation.
  const message = feedback ?? limitInfo;

  return (
    <div className="mt-4">
      <Button
        type="button"
        onClick={add}
        // aria-disabled keeps keyboard focus on the button while adding and at the limit
        // (a natively disabled button drops focus). Clicks are ignored in add().
        aria-disabled={pending || atLimit || undefined}
        aria-describedby="add-to-bag-status ordering-note"
        className="h-12 w-full rounded-none text-xs font-bold tracking-label uppercase aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        {pending ? "Adding…" : atLimit ? "Maximum in Bag" : "Add to Bag"}
      </Button>

      <p
        id="add-to-bag-status"
        role="status"
        aria-live="polite"
        className={cn(
          "mt-2 min-h-5 text-xs",
          message?.tone === "error" ? "text-destructive" : "text-foreground",
        )}
      >
        {message ? (
          <>
            {message.text}
            {message.link ? (
              <>
                {" "}
                <Link
                  href={message.link.href}
                  className="font-semibold underline underline-offset-4"
                >
                  {message.link.label}
                </Link>
              </>
            ) : null}
          </>
        ) : null}
      </p>

      <p id="ordering-note" className="mt-1 text-xs text-muted-foreground">
        Checkout isn’t available yet. No payment is taken on this site.
      </p>

      <StorageNotice
        ready={cart.ready}
        status={cart.status}
        dropped={cart.dropped}
        scope="bag"
        className="mt-3"
      />
    </div>
  );
}
