"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

import { DemoTag } from "@/components/store/demo-tag";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import {
  adjustmentMessage,
  bagActionMessage,
  lineLabel,
  quantityChangeMessage,
  quantityLimitHint,
  type Feedback,
} from "@/lib/cart/cart-feedback";
import type { CartActionResult, SimpleActionResult } from "@/lib/cart/cart-repository";
import { toAvailability, type ResolvedCartLine } from "@/lib/cart/resolve-cart";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

import { QuantityStepper } from "./quantity-stepper";

/**
 * One bag line. Every action is guarded against repeated clicks (synchronous in-flight guard plus
 * disabled controls while saving) and reports success only after the change was saved.
 */
export function CartLineItem({
  resolved,
  registerHeading,
  onAnnounce,
  onRemoveStart,
  onRemoveEnd,
}: {
  resolved: ResolvedCartLine;
  registerHeading: (variantId: string, el: HTMLHeadingElement | null) => void;
  onAnnounce: (feedback: Feedback) => void;
  /** Called before removing, so the page can plan where focus goes once the line is gone. */
  onRemoveStart: (variantId: string) => void;
  onRemoveEnd: (variantId: string, removed: boolean) => void;
}) {
  const cart = useCart();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { line, status, product, variant, image, adjustment, limit } = resolved;
  const id = line.variantId;
  const name = product?.name ?? "Item no longer available";
  const label = lineLabel(name, variant?.colourName ?? null, variant?.size ?? null);
  const href = product
    ? `/product/${product.slug}${variant ? `?colour=${variant.colourSlug}` : ""}`
    : null;
  const availability = product && variant ? toAvailability(product, variant) : null;
  const purchasable = status === "ok" || status === "adjusted";
  const hintId = `line-${id}-hint`;

  async function run<T extends CartActionResult | SimpleActionResult>(
    action: () => Promise<T>,
    message: (result: T) => Feedback,
    hooks?: { start: () => void; end: (ok: boolean) => void },
  ) {
    if (inFlight.current) return; // a second click before re-render is ignored
    inFlight.current = true;
    setPending(true);
    try {
      hooks?.start();
      const result = await action();
      const feedback = message(result);
      setError(result.ok ? null : feedback.text);
      hooks?.end(result.ok);
      onAnnounce(feedback); // success text only when the change was saved
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const changeQuantity = (next: number) =>
    run(
      () => cart.setQuantity(id, next, availability),
      (r) => quantityChangeMessage(r, label, cart.isPersisted()),
    );
  const acknowledge = () =>
    run(
      () => cart.acknowledgeAvailability(id, availability),
      (r) => quantityChangeMessage(r, label, cart.isPersisted()),
    );
  const remove = () =>
    run(
      () => cart.remove(id),
      (r) => bagActionMessage(r, { kind: "remove", label }, cart.isPersisted()),
      { start: () => onRemoveStart(id), end: (ok) => onRemoveEnd(id, ok) },
    );

  const atLimit = purchasable && resolved.quantity >= limit;
  const hint = error ?? (atLimit && !adjustment ? quantityLimitHint(limit) : null);

  return (
    <li
      data-cart-line=""
      data-variant-id={id}
      data-line-status={status}
      className="grid grid-cols-[88px_1fr] gap-4 border-b border-border py-5 first:pt-0 sm:grid-cols-[120px_1fr] sm:gap-5"
    >
      <div
        className={cn(
          "relative aspect-3/4 overflow-hidden bg-offwhite",
          !purchasable && "opacity-60 grayscale",
        )}
      >
        {image && href ? (
          <Link href={href} tabIndex={-1} aria-hidden>
            <Image src={image.url} alt={image.alt} fill sizes="120px" className="object-cover" />
          </Link>
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff aria-hidden className="size-5" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h3
              ref={(el) => registerHeading(id, el)}
              tabIndex={-1}
              className="text-sm font-bold tracking-tight uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {href ? (
                <Link href={href} className="hover:underline hover:underline-offset-4">
                  {name}
                </Link>
              ) : (
                name
              )}
            </h3>
            {variant ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Colour: {variant.colourName}
                <span aria-hidden> · </span>
                <span className="sr-only">, </span>
                Size: {variant.size}
              </p>
            ) : null}
            {status !== "unavailable" ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span>
                  <span className="sr-only">Unit price: </span>
                  {formatPrice(resolved.unitPrice)}
                </span>
                <DemoTag />
              </p>
            ) : null}
          </div>
          <p className="text-sm font-semibold tabular-nums sm:text-right" data-line-total>
            {purchasable ? (
              <>
                <span className="sr-only">Line total: </span>
                {formatPrice(resolved.lineTotal)}
              </>
            ) : (
              <span className="text-xs font-normal text-muted-foreground">Not included</span>
            )}
          </p>
        </div>

        {adjustment ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border border-ink/15 bg-offwhite px-3 py-2 text-xs">
            <span data-adjustment>{adjustmentMessage(adjustment)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none aria-disabled:opacity-50"
              aria-disabled={pending}
              onClick={acknowledge}
            >
              Update to {adjustment.to}
            </Button>
          </div>
        ) : null}
        {status === "sold_out" ? (
          <p className="mt-3 text-xs font-semibold" data-line-note>
            Sold out (demo stock). Remove it to tidy your bag.
          </p>
        ) : null}
        {status === "unavailable" ? (
          <p className="mt-3 text-xs font-semibold" data-line-note>
            No longer available. Saved quantity: {line.quantity}.
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {status !== "unavailable" ? (
            <QuantityStepper
              label={label}
              quantity={purchasable ? resolved.quantity : line.quantity}
              limit={purchasable ? limit : 0}
              disabled={pending || !purchasable}
              onChange={changeQuantity}
              describedBy={hint ? hintId : undefined}
            />
          ) : null}
          <Button
            type="button"
            variant="link"
            className="h-11 px-0 text-xs font-semibold tracking-label uppercase aria-disabled:opacity-50"
            aria-label={`Remove ${label}`}
            aria-disabled={pending}
            onClick={remove}
          >
            Remove
          </Button>
        </div>
        <p
          id={hintId}
          className={cn(
            "mt-1 min-h-4 text-xs",
            error ? "text-destructive" : "text-muted-foreground",
          )}
          data-line-hint
        >
          {hint ?? ""}
        </p>
      </div>
    </li>
  );
}
