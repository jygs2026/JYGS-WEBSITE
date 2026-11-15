import { Button } from "@/components/ui/button";
import { excludedNote, itemCount, savedCountNote } from "@/lib/cart/cart-feedback";
import type { ResolvedCart } from "@/lib/cart/resolve-cart";
import { formatPrice } from "@/lib/format";

/**
 * Subtotal only (approved decision G): no shipping, tax or order. Checkout is disabled and no
 * payment is taken anywhere on the site.
 */
export function OrderSummary({ cart }: { cart: ResolvedCart }) {
  const excluded = excludedNote(cart.unavailableCount);
  const savedNote = savedCountNote(cart.storedUnits, cart.units);
  return (
    <section
      aria-labelledby="order-summary-heading"
      className="border border-ink/15 bg-offwhite p-5 md:p-6 lg:sticky lg:top-24"
    >
      <h2 id="order-summary-heading" className="text-sm font-black tracking-label uppercase">
        Order summary
      </h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt>Items</dt>
          <dd className="tabular-nums" data-summary-items>
            {itemCount(cart.units)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-ink/15 pt-3 font-bold">
          <dt>
            Subtotal <span className="font-normal text-muted-foreground">(demo prices)</span>
          </dt>
          <dd className="tabular-nums" data-subtotal>
            {formatPrice(cart.subtotal)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Shipping and taxes are not calculated yet.
      </p>
      {excluded ? (
        <p className="mt-2 text-xs" data-excluded-note>
          {excluded}
        </p>
      ) : null}
      {savedNote ? (
        <p className="mt-2 text-xs" data-saved-count-note>
          {savedNote}
        </p>
      ) : null}
      <Button
        type="button"
        disabled
        aria-describedby="no-payment-note"
        className="mt-5 h-12 w-full rounded-none text-xs font-bold tracking-label uppercase"
      >
        Checkout — Coming Soon
      </Button>
      <p id="no-payment-note" className="mt-2 text-center text-xs text-muted-foreground">
        No payment is taken on this site.
      </p>
    </section>
  );
}
