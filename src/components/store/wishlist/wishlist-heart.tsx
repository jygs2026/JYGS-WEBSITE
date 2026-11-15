"use client";

import { Heart } from "lucide-react";
import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";

import { useWishlist } from "@/hooks/use-wishlist";
import { cn } from "@/lib/utils";
import { acceptsHeartClick } from "@/lib/wishlist/heart-click";
import { heartMessage, heartView } from "@/lib/wishlist/wishlist-feedback";
import { findItem } from "@/lib/wishlist/wishlist-model";

/**
 * Wishlist heart for a listing card showing `colourId` (Shop, Category and Collection only).
 *
 * - Not saved → saves in this colour. Saved in this colour → removes. Saved in another colour
 *   (or none) → changes the saved colour to this one. Never a duplicate entry.
 * - A plain button (no aria-pressed): its name states the status, then what a click will do.
 * - Before the wishlist has loaded, and while saving, it is aria-disabled (focus is kept) and
 *   clicks are ignored. Every actual outcome is announced.
 * - The click goes through the safe sequence (interrupted moves recovered first, then a write
 *   that applies only if the item still looks as the heart showed).
 */
export function WishlistHeart({
  productId,
  productName,
  colourId,
  colours,
  className,
}: {
  productId: string;
  productName: string;
  /** The colourway this card shows. */
  colourId: string;
  /** The product's colours (to name a saved colour). */
  colours: { id: string; name: string }[];
  className?: string;
}) {
  const wishlist = useWishlist();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState({ id: 0, text: "" });

  // When the loaded state was first committed to the page. A layout effect runs right after the
  // DOM update and before paint, so no click on the visibly loaded heart can predate it.
  const readySince = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (wishlist.ready && readySince.current === null) readySince.current = performance.now();
  }, [wishlist.ready]);

  const item = wishlist.ready ? findItem(wishlist.data, productId) : undefined;
  const nameOf = (id: string | null) =>
    id ? (colours.find((c) => c.id === id)?.name ?? null) : null;
  const cardColour = nameOf(colourId) ?? "this colour";
  const savedColour = item ? nameOf(item.colourId) : null;
  const view = heartView({
    ready: wishlist.ready,
    productName,
    cardColour,
    saved: item
      ? {
          sameColour: item.colourId === colourId,
          colourName: savedColour,
          hasColour: item.colourId !== null,
        }
      : undefined,
  });
  const disabled = !wishlist.ready || pending;

  async function onClick(event: MouseEvent<HTMLButtonElement>) {
    // Ignored: not loaded yet; a click that ARRIVED while the heart still showed "loading" (React
    // may deliver it after hydrating synchronously, when the wishlist is already loaded); or a
    // repeated click while saving. `event.timeStamp` and `performance.now()` share a time origin.
    if (!wishlist.ready || !acceptsHeartClick(readySince.current, event.timeStamp)) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      const expected = item
        ? ({ saved: true, colourId: item.colourId } as const)
        : ({ saved: false } as const);
      const result = await wishlist.heart(productId, colourId, expected);
      const feedback = heartMessage(
        result,
        { product: productName, cardColour, fromColour: savedColour },
        wishlist.isPersisted(),
      );
      setMessage((m) => ({ id: m.id + 1, text: feedback.text }));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={view.label}
        title={view.tooltip}
        aria-disabled={disabled || undefined}
        data-wishlist-heart=""
        data-wishlist-state={view.state}
        onClick={onClick}
        className={cn(
          "flex size-11 items-center justify-center rounded-full bg-paper/85 text-ink backdrop-blur-sm transition-colors hover:bg-paper focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:cursor-default",
          className,
        )}
      >
        <span className="relative">
          <Heart
            aria-hidden
            className="size-5"
            strokeWidth={1.8}
            fill={view.state === "saved" ? "currentColor" : "none"}
          />
          {view.state === "other-colour" ? (
            <span
              aria-hidden
              className="absolute -right-1 -bottom-0.5 size-2.5 rounded-full border border-paper bg-ink"
            />
          ) : null}
        </span>
      </button>
      <span role="status" className="sr-only" data-heart-announcer="">
        <span key={message.id}>{message.text}</span>
      </span>
    </>
  );
}
