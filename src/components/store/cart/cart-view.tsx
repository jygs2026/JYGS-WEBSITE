"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StorageNotice } from "@/components/store/storage-notice";
import { useCart } from "@/hooks/use-cart";
import { itemCount, type Feedback } from "@/lib/cart/cart-feedback";
import { indexCatalog, resolveCart } from "@/lib/cart/resolve-cart";
import type { CartCatalog } from "@/types";

import { CartEmpty } from "./cart-empty";
import { CartLineItem } from "./cart-line-item";
import { CartSkeleton } from "./cart-skeleton";
import { ClearCartDialog } from "./clear-cart-dialog";
import { OrderSummary } from "./order-summary";

/**
 * Focus to apply once its target exists:
 * - after a removal (only once the removed line has really gone): the first candidate line that
 *   still exists (next line, else previous line), else the empty-bag heading, else the page heading;
 * - after clearing: the empty-bag heading.
 */
type FocusRequest =
  { kind: "removed"; variantId: string; candidates: string[] } | { kind: "empty" };

/**
 * The bag page (client). Saved lines are joined with the current catalogue for display (prices,
 * stock and images never come from storage). All changes go through the cart repository
 * (cross-tab lock → fresh read → validated write), so the header badge, this page and other tabs
 * stay in sync and newer data from another tab is never overwritten.
 */
export function CartView({ catalog }: { catalog: CartCatalog }) {
  const cart = useCart();
  const index = useMemo(() => indexCatalog(catalog), [catalog]);
  const resolved = useMemo(() => resolveCart(cart.data, index), [cart.data, index]);

  // Live announcements: a counter in the key makes repeated identical messages re-announce.
  const [announcement, setAnnouncement] = useState<{ id: number; text: string }>({
    id: 0,
    text: "",
  });
  const announce = useCallback(
    (feedback: Feedback) => setAnnouncement((a) => ({ id: a.id + 1, text: feedback.text })),
    [],
  );

  // Focus management after removals / clearing / changes from another tab.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const emptyHeadingRef = useRef<HTMLHeadingElement>(null);
  const lineHeadings = useRef(new Map<string, HTMLHeadingElement>());
  const focusRequest = useRef<FocusRequest | null>(null);
  const lastFocusedLine = useRef<string | null>(null);
  const tabAnnouncerRef = useRef<HTMLParagraphElement>(null);

  const registerHeading = useCallback((variantId: string, el: HTMLHeadingElement | null) => {
    if (el) lineHeadings.current.set(variantId, el);
    else lineHeadings.current.delete(variantId);
  }, []);

  // Runs after every render: focus intent is recorded BEFORE an action starts (the store may
  // re-render before the action's promise resolves) and applied once its target exists.
  useEffect(() => {
    const request = focusRequest.current;
    if (request) {
      if (request.kind === "removed" && lineHeadings.current.has(request.variantId)) return; // not gone yet
      const target =
        request.kind === "removed"
          ? (request.candidates.map((id) => lineHeadings.current.get(id)).find(Boolean) ??
            emptyHeadingRef.current ??
            headingRef.current)
          : emptyHeadingRef.current;
      if (target) {
        focusRequest.current = null;
        target.focus();
      }
      return;
    }
    // A line removed in another tab while focus was inside it: move focus to the page heading.
    const focused = lastFocusedLine.current;
    if (focused && !lineHeadings.current.has(focused)) {
      lastFocusedLine.current = null;
      const active = document.activeElement;
      if (!active || active === document.body) {
        (headingRef.current ?? emptyHeadingRef.current)?.focus();
        // Written straight to its own live region (not React state) to avoid a cascading render.
        if (tabAnnouncerRef.current) {
          tabAnnouncerRef.current.textContent = "Your bag was updated in another tab.";
        }
      }
    }
  });

  /**
   * A removal is starting: remember where focus should go (next line, else previous line) but do
   * NOT move it yet — another tab's change during the removal must not move focus early.
   */
  const plannedFocus = useRef(new Map<string, string[]>());
  const onRemoveStart = useCallback(
    (variantId: string) => {
      const ids = resolved.lines.map((l) => l.line.variantId);
      const at = ids.indexOf(variantId);
      plannedFocus.current.set(
        variantId,
        [ids[at + 1], ids[at - 1]].filter((id): id is string => Boolean(id)),
      );
      lastFocusedLine.current = null; // this line leaving is expected, not another tab's change
    },
    [resolved.lines],
  );

  /** Moves focus only when the removal succeeded and the line is actually gone. */
  const onRemoveEnd = useCallback((variantId: string, removed: boolean) => {
    const candidates = plannedFocus.current.get(variantId) ?? [];
    plannedFocus.current.delete(variantId);
    if (removed) focusRequest.current = { kind: "removed", variantId, candidates };
  }, []);

  const onClearStart = useCallback(() => {
    lastFocusedLine.current = null;
    focusRequest.current = { kind: "empty" };
  }, []);

  const onClearEnd = useCallback((cleared: boolean) => {
    if (!cleared) focusRequest.current = null;
  }, []);

  const hasLines = cart.ready && resolved.lines.length > 0;

  return (
    <div className="container-site py-8 md:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 md:mb-8">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-black tracking-tight uppercase outline-none md:text-5xl"
        >
          Your Bag
          {hasLines ? (
            <span className="ml-3 align-middle text-sm font-semibold tracking-normal text-muted-foreground normal-case md:text-base">
              ({itemCount(resolved.units)})
            </span>
          ) : null}
        </h1>
      </header>

      <StorageNotice
        ready={cart.ready}
        status={cart.status}
        dropped={cart.dropped}
        scope="bag"
        className="mb-6"
      />

      <p className="sr-only" role="status" aria-live="polite" data-cart-announcer>
        <span key={announcement.id}>{announcement.text}</span>
      </p>
      <p ref={tabAnnouncerRef} className="sr-only" role="status" aria-live="polite" />

      {!cart.ready ? (
        <CartSkeleton />
      ) : !hasLines ? (
        <CartEmpty headingRef={emptyHeadingRef} />
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px] lg:gap-12">
          <section aria-labelledby="bag-items-heading">
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-ink pb-2">
              <h2 id="bag-items-heading" className="text-sm font-black tracking-label uppercase">
                Bag items
              </h2>
              <ClearCartDialog
                storedUnits={resolved.storedUnits}
                countedUnits={resolved.units}
                onClearStart={onClearStart}
                onClearEnd={onClearEnd}
                onAnnounce={announce}
              />
            </div>
            <ul
              aria-labelledby="bag-items-heading"
              onFocus={(e) => {
                const li = (e.target as HTMLElement).closest<HTMLElement>("[data-variant-id]");
                lastFocusedLine.current = li?.dataset.variantId ?? null;
              }}
            >
              {resolved.lines.map((line) => (
                <CartLineItem
                  key={line.line.variantId}
                  resolved={line}
                  registerHeading={registerHeading}
                  onAnnounce={announce}
                  onRemoveStart={onRemoveStart}
                  onRemoveEnd={onRemoveEnd}
                />
              ))}
            </ul>
          </section>
          <OrderSummary cart={resolved} />
        </div>
      )}
    </div>
  );
}
