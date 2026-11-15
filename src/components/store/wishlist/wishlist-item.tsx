"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

import { DemoTag } from "@/components/store/demo-tag";
import { SIZE_LABELS } from "@/config/product-info";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/use-wishlist";
import { toAvailability } from "@/lib/cart/resolve-cart";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ResolvedWishlistItem } from "@/lib/wishlist/resolve-wishlist";
import {
  moveMessage,
  RECOVERY_PENDING_NOTE,
  removeMessage,
  statusNote,
  type WishlistMessage,
} from "@/lib/wishlist/wishlist-feedback";
import type { SizeLabel } from "@/types";

export interface RowCallbacks {
  registerHeading: (productId: string, el: HTMLHeadingElement | null) => void;
  onAnnounce: (message: WishlistMessage) => void;
  /** Page-level confirmation (kept visible after the row leaves), e.g. with a View Bag link. */
  onConfirm: (message: WishlistMessage & { viewBag?: boolean }) => void;
  /**
   * Called when an action that may remove the row starts (plan focus, clear the old confirmation)
   * and when it ends (`left`: the row was really removed — only then does focus move).
   */
  onLeaveStart: (productId: string) => void;
  onLeaveEnd: (productId: string, left: boolean) => void;
}

/**
 * One wishlist row: image, name, saved colour, demo price, size picker, Add to Bag and Remove.
 * Add to Bag is only possible for the SAVED colour — never another colour (no substitution).
 * Every action is guarded against repeated clicks and reports success only when it happened.
 */
export function WishlistItemRow({
  resolved,
  savedColourName,
  recoveryPending,
  callbacks,
}: {
  resolved: ResolvedWishlistItem;
  savedColourName: string | null;
  /** Page-load recovery of an interrupted move could not finish. */
  recoveryPending: boolean;
  callbacks: RowCallbacks;
}) {
  const wishlist = useWishlist();
  const inFlight = useRef(false);
  const sizeGroupRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [size, setSize] = useState<SizeLabel | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [rowMessage, setRowMessage] = useState<WishlistMessage | null>(null);

  const { item, status, product, colour, image, sizes } = resolved;
  const id = item.productId;
  const name = product?.name ?? "Item no longer available";
  const label = colour ? `${name}, ${colour.name}` : name;
  const href = product ? `/product/${product.slug}${colour ? `?colour=${colour.slug}` : ""}` : null;
  const note = statusNote(status, savedColourName);
  const canAdd = status === "ok";
  const showSizes = status !== "unavailable";
  const needsColourChoice = status === "no_colour" || status === "colour_unavailable";
  const noteId = `wishlist-${id}-note`;
  const messageId = `wishlist-${id}-message`;
  const sizeName = `wishlist-size-${id}`;

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return; // a second click before re-render is ignored
    inFlight.current = true;
    setPending(true);
    try {
      await action();
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function addToBag() {
    if (!canAdd || pending) return; // aria-disabled: the reason is in the note
    if (!size) {
      setSizeError(true);
      sizeGroupRef.current
        ?.querySelector<HTMLInputElement>('input[type="radio"]:not(:disabled)')
        ?.focus();
      return;
    }
    const option = sizes.find((s) => s.label === size);
    const variant = option?.variant && product ? toAvailability(product, option.variant) : null;
    void run(async () => {
      callbacks.onLeaveStart(id);
      const result = await wishlist.moveToCart(id, variant);
      const message = moveMessage(result, `${label}, ${size}`);
      const left = result.status === "moved" || result.status === "already-moved";
      callbacks.onLeaveEnd(id, left);
      if (left) {
        callbacks.onConfirm({ ...message, viewBag: true });
      } else {
        setRowMessage(message);
        callbacks.onAnnounce(message);
      }
    });
  }

  function remove() {
    void run(async () => {
      callbacks.onLeaveStart(id);
      const result = await wishlist.safeRemove(id, { colourId: item.colourId });
      const message = removeMessage(result, label, wishlist.isPersisted());
      const left =
        result.ok && (result.outcome.kind === "removed" || result.outcome.kind === "already-moved");
      callbacks.onLeaveEnd(id, left);
      if (!left) setRowMessage(message);
      callbacks.onAnnounce(message);
    });
  }

  return (
    <li
      data-wishlist-item=""
      data-product-id={id}
      data-item-status={status}
      className="grid grid-cols-[88px_1fr] gap-4 border-b border-border py-5 first:pt-0 sm:grid-cols-[120px_1fr] sm:gap-5"
    >
      <div
        className={cn(
          "relative aspect-3/4 overflow-hidden bg-offwhite",
          status !== "ok" && "opacity-60 grayscale",
        )}
      >
        {image && href ? (
          <Link href={href} tabIndex={-1} aria-hidden>
            <Image src={image.url} alt="" fill sizes="120px" className="object-cover" />
          </Link>
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff aria-hidden className="size-5" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <h3
          ref={(el) => callbacks.registerHeading(id, el)}
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
        {colour ? (
          <p className="mt-1 text-xs text-muted-foreground">Colour: {colour.name}</p>
        ) : null}
        {product ? (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span>
              <span className="sr-only">Price: </span>
              {formatPrice(resolved.price)}
            </span>
            <DemoTag />
          </p>
        ) : null}

        {note ? (
          <p id={noteId} className="mt-3 text-xs font-semibold" data-item-note="">
            {note}
            {needsColourChoice && product ? (
              <>
                {" "}
                <Link
                  href={`/product/${product.slug}`}
                  className="underline underline-offset-4"
                  data-choose-colour=""
                >
                  Choose a colour
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
        {recoveryPending ? (
          <p className="mt-3 text-xs font-semibold" data-recovery-note="">
            {RECOVERY_PENDING_NOTE}{" "}
            <Link href="/cart" className="underline underline-offset-4">
              View Bag
            </Link>
          </p>
        ) : null}

        {showSizes ? (
          <fieldset
            className="mt-3"
            aria-describedby={
              [note ? noteId : null, sizeError ? `${messageId}-size` : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
          >
            <legend className="text-xs font-semibold tracking-label uppercase">
              Size:{" "}
              <span className="font-normal tracking-normal normal-case">
                {size ?? "Select a size"}
              </span>
            </legend>
            <div ref={sizeGroupRef} className="mt-2 grid max-w-sm grid-cols-5 gap-2">
              {SIZE_LABELS.map((labelText) => {
                const option = sizes.find((s) => s.label === labelText);
                const disabled = !canAdd || !option?.variant || option.available <= 0;
                const suffix = !canAdd
                  ? ""
                  : !option?.variant
                    ? " — not available in this colour"
                    : option.available <= 0
                      ? " — sold out"
                      : "";
                return (
                  <label key={labelText} className={cn("relative", !disabled && "cursor-pointer")}>
                    <input
                      type="radio"
                      name={sizeName}
                      value={labelText}
                      checked={size === labelText}
                      disabled={disabled}
                      onChange={() => {
                        setSize(labelText);
                        setSizeError(false);
                      }}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "flex h-11 items-center justify-center border text-sm font-semibold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                        disabled
                          ? "border-border bg-offwhite text-muted-foreground/60 line-through"
                          : "border-input peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper hover:border-ink",
                      )}
                    >
                      {labelText}
                      <span className="sr-only">{suffix}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {sizeError ? (
              <p
                id={`${messageId}-size`}
                role="alert"
                className="mt-2 text-xs font-semibold text-destructive"
              >
                Please select a size.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {showSizes ? (
            <Button
              type="button"
              aria-disabled={!canAdd || pending || undefined}
              aria-describedby={note ? noteId : undefined}
              onClick={addToBag}
              className="h-11 w-full rounded-none text-xs font-bold tracking-label uppercase aria-disabled:cursor-not-allowed aria-disabled:opacity-50 sm:w-auto sm:px-8"
            >
              Add to Bag
            </Button>
          ) : null}
          <Button
            type="button"
            variant="link"
            aria-label={`Remove ${label} from wishlist`}
            aria-disabled={pending || undefined}
            onClick={remove}
            className="h-11 px-0 text-xs font-semibold tracking-label uppercase aria-disabled:opacity-50"
          >
            Remove
          </Button>
        </div>
        <p
          id={messageId}
          className={cn(
            "mt-1 min-h-4 text-xs",
            rowMessage?.tone === "error" ? "text-destructive" : "text-foreground",
          )}
          data-item-message=""
        >
          {rowMessage?.text ?? ""}
        </p>
      </div>
    </li>
  );
}
