"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CtaLink } from "@/components/store/cta-link";
import { StorageNotice } from "@/components/store/storage-notice";
import { useWishlist } from "@/hooks/use-wishlist";
import { indexCatalog } from "@/lib/cart/resolve-cart";
import { cn } from "@/lib/utils";
import { resolveWishlist, savedColourName } from "@/lib/wishlist/resolve-wishlist";
import { recoveredMessage, type WishlistMessage } from "@/lib/wishlist/wishlist-feedback";
import type { CartCatalog } from "@/types";

import { WishlistEmpty } from "./wishlist-empty";
import { WishlistItemRow, type RowCallbacks } from "./wishlist-item";
import { WishlistSkeleton } from "./wishlist-skeleton";

/**
 * Focus to apply once a row has really gone: the first candidate row that still exists (next row,
 * else previous row), else the empty-wishlist heading, else the page heading.
 */
type FocusRequest = { productId: string; candidates: string[] };

/**
 * The wishlist page (client), single-column rows on every screen size. Saved items are joined
 * with the current catalogue (never stored prices/stock). On load, interrupted moves to the bag
 * are recovered once per item (M3.1 recovery — never adds to the bag twice).
 */
export function WishlistView({ catalog }: { catalog: CartCatalog }) {
  const wishlist = useWishlist();
  const index = useMemo(() => indexCatalog(catalog), [catalog]);
  const resolved = useMemo(() => resolveWishlist(wishlist.data, index), [wishlist.data, index]);

  const [announcement, setAnnouncement] = useState({ id: 0, text: "" });
  const announce = useCallback(
    (message: WishlistMessage) => setAnnouncement((a) => ({ id: a.id + 1, text: message.text })),
    [],
  );
  const [confirmation, setConfirmation] = useState<
    (WishlistMessage & { viewBag?: boolean }) | null
  >(null);
  const onConfirm = useCallback(
    (message: WishlistMessage & { viewBag?: boolean }) => {
      setConfirmation(message);
      announce(message);
    },
    [announce],
  );

  // --- Recovery of interrupted moves (once per item per page load) ---------------------------
  const attempted = useRef(new Set<string>());
  const [recoveryPending, setRecoveryPending] = useState<ReadonlySet<string>>(new Set());
  const pendingIds = resolved
    .filter((r) => r.pendingMove)
    .map((r) => r.item.productId)
    .join("|");
  const { ready, finishMove } = wishlist; // finishMove has a stable identity (see useWishlist)
  useEffect(() => {
    if (!ready) return;
    const pending = new Set(pendingIds ? pendingIds.split("|") : []);
    // Items no longer marked may be recovered again if a new marker appears later.
    for (const productId of attempted.current) {
      if (!pending.has(productId)) attempted.current.delete(productId);
    }
    for (const productId of pending) {
      if (attempted.current.has(productId)) continue;
      attempted.current.add(productId);
      const name = index.product(productId)?.name ?? "This item";
      void finishMove(productId).then((result) => {
        const finished =
          result.status === "moved" ||
          result.status === "already-moved" ||
          (result.status === "failed" && result.reason === "not_in_cart"); // marker cleared
        if (result.status === "moved") {
          setAnnouncement((a) => ({ id: a.id + 1, text: recoveredMessage(name) }));
        }
        setRecoveryPending((prev) => {
          const next = new Set(prev);
          if (finished) next.delete(productId);
          else next.add(productId);
          return next;
        });
      });
    }
  }, [ready, finishMove, pendingIds, index]);

  // --- Focus management (same approach as the bag page) --------------------------------------
  const headingRef = useRef<HTMLHeadingElement>(null);
  const emptyHeadingRef = useRef<HTMLHeadingElement>(null);
  const rowHeadings = useRef(new Map<string, HTMLHeadingElement>());
  const focusRequest = useRef<FocusRequest | null>(null);
  const lastFocusedRow = useRef<string | null>(null);
  const tabAnnouncerRef = useRef<HTMLParagraphElement>(null);

  const registerHeading = useCallback((productId: string, el: HTMLHeadingElement | null) => {
    if (el) rowHeadings.current.set(productId, el);
    else rowHeadings.current.delete(productId);
  }, []);

  // After every render: apply planned focus once its target exists; recover focus if the focused
  // row disappeared because of another tab.
  useEffect(() => {
    const request = focusRequest.current;
    if (request) {
      if (rowHeadings.current.has(request.productId)) return; // the row has not left yet
      const target =
        request.candidates.map((id) => rowHeadings.current.get(id)).find(Boolean) ??
        emptyHeadingRef.current ??
        headingRef.current;
      if (target) {
        focusRequest.current = null;
        target.focus();
      }
      return;
    }
    const focused = lastFocusedRow.current;
    if (focused && !rowHeadings.current.has(focused)) {
      lastFocusedRow.current = null;
      const active = document.activeElement;
      if (!active || active === document.body) {
        (headingRef.current ?? emptyHeadingRef.current)?.focus();
        if (tabAnnouncerRef.current) {
          tabAnnouncerRef.current.textContent = "Your wishlist was updated in another tab.";
        }
      }
    }
  });

  /**
   * An action that may remove a row is starting: remember where focus should go (next row, else
   * previous row) and clear the previous page-level confirmation. Focus is NOT moved yet.
   */
  const plannedFocus = useRef(new Map<string, string[]>());
  const onLeaveStart = useCallback(
    (productId: string) => {
      const ids = resolved.map((r) => r.item.productId);
      const at = ids.indexOf(productId);
      plannedFocus.current.set(
        productId,
        [ids[at + 1], ids[at - 1]].filter((id): id is string => Boolean(id)),
      );
      lastFocusedRow.current = null; // this row leaving is expected, not another tab's change
      setConfirmation(null);
    },
    [resolved],
  );
  /** Moves focus only when the action succeeded and the row is actually gone. */
  const onLeaveEnd = useCallback((productId: string, left: boolean) => {
    const candidates = plannedFocus.current.get(productId) ?? [];
    plannedFocus.current.delete(productId);
    if (left) focusRequest.current = { productId, candidates };
  }, []);

  const callbacks: RowCallbacks = useMemo(
    () => ({ registerHeading, onAnnounce: announce, onConfirm, onLeaveStart, onLeaveEnd }),
    [registerHeading, announce, onConfirm, onLeaveStart, onLeaveEnd],
  );

  const hasItems = wishlist.ready && resolved.length > 0;

  return (
    <div className="container-site py-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 md:mb-8">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl font-black tracking-tight uppercase outline-none md:text-5xl"
          >
            Wishlist
            {hasItems ? (
              <span className="ml-3 align-middle text-sm font-semibold tracking-normal text-muted-foreground normal-case md:text-base">
                ({resolved.length} {resolved.length === 1 ? "item" : "items"})
              </span>
            ) : null}
          </h1>
        </header>

        <StorageNotice
          ready={wishlist.ready}
          status={wishlist.status}
          dropped={wishlist.dropped}
          scope="wishlist"
          className="mb-6"
        />

        <p className="sr-only" role="status" aria-live="polite" data-wishlist-announcer="">
          <span key={announcement.id}>{announcement.text}</span>
        </p>
        <p ref={tabAnnouncerRef} className="sr-only" role="status" aria-live="polite" />

        {confirmation ? (
          <p
            data-wishlist-confirmation=""
            className={cn(
              "mb-6 border px-3 py-2.5 text-sm",
              confirmation.tone === "error"
                ? "border-destructive/40 text-destructive"
                : "border-ink/15 bg-offwhite",
            )}
          >
            {confirmation.text}
            {confirmation.viewBag ? (
              <>
                {" "}
                <Link href="/cart" className="font-semibold underline underline-offset-4">
                  View Bag
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        {!wishlist.ready ? (
          <WishlistSkeleton />
        ) : !hasItems ? (
          <WishlistEmpty headingRef={emptyHeadingRef} />
        ) : (
          <section aria-labelledby="wishlist-items-heading">
            <h2 id="wishlist-items-heading" className="sr-only">
              Saved items
            </h2>
            <ul
              aria-labelledby="wishlist-items-heading"
              className="border-t border-ink pt-5"
              onFocus={(e) => {
                const li = (e.target as HTMLElement).closest<HTMLElement>("[data-product-id]");
                lastFocusedRow.current = li?.dataset.productId ?? null;
              }}
            >
              {resolved.map((r) => (
                <WishlistItemRow
                  key={r.item.productId}
                  resolved={r}
                  savedColourName={savedColourName(r.item, index)}
                  // Shown only while the item still carries its move marker (never stale).
                  recoveryPending={r.pendingMove && recoveryPending.has(r.item.productId)}
                  callbacks={callbacks}
                />
              ))}
            </ul>
            <div className="mt-8">
              <CtaLink href="/shop" variant="outlineDark">
                Continue Shopping
              </CtaLink>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
