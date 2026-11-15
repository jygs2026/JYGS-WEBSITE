"use client";

import { Minus, Plus } from "lucide-react";

/**
 * − / quantity / + control. − is disabled at 1 (lines are removed with Remove); + is disabled at
 * the line limit. The quantity is announced through the cart page's live region after a change.
 *
 * Buttons use `aria-disabled` (not the `disabled` attribute): a natively disabled button drops
 * keyboard focus, so a keyboard user pressing + while it saves — or reaching the limit — would be
 * thrown back to the top of the page. Clicks on an aria-disabled button are ignored here.
 */
export function QuantityStepper({
  label,
  quantity,
  limit,
  disabled,
  onChange,
  describedBy,
}: {
  /** e.g. "Signature Oversized Tee, Black, M" */
  label: string;
  quantity: number;
  limit: number;
  disabled: boolean;
  onChange: (next: number) => void;
  describedBy?: string;
}) {
  const button =
    "flex size-11 items-center justify-center transition-colors hover:bg-offwhite focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:text-muted-foreground/50 aria-disabled:hover:bg-transparent";
  const canDecrease = !disabled && quantity > 1;
  const canIncrease = !disabled && quantity < limit;
  return (
    <div
      role="group"
      aria-label={`Quantity for ${label}`}
      aria-describedby={describedBy}
      className="inline-flex items-center border border-input"
    >
      <button
        type="button"
        className={button}
        aria-label={`Decrease quantity of ${label}`}
        aria-disabled={!canDecrease}
        onClick={() => canDecrease && onChange(quantity - 1)}
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <span className="min-w-9 text-center text-sm font-semibold tabular-nums">
        <span className="sr-only">Quantity: </span>
        <span data-quantity>{quantity}</span>
      </span>
      <button
        type="button"
        className={button}
        aria-label={`Increase quantity of ${label}`}
        aria-disabled={!canIncrease}
        onClick={() => canIncrease && onChange(quantity + 1)}
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  );
}
