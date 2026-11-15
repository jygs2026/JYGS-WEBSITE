/**
 * Pure wishlist business logic. One entry per product; saving again only updates the remembered
 * colour (original addedAt kept). Returns the same object when nothing changes.
 */
import type { PendingMove, WishlistItem, WishlistState } from "@/types";

export const emptyWishlist = (): WishlistState => ({ items: [] });

export function findItem(state: WishlistState, productId: string): WishlistItem | undefined {
  return state.items.find((i) => i.productId === productId);
}

export const isInWishlist = (state: WishlistState, productId: string) =>
  Boolean(findItem(state, productId));

export const countItems = (state: WishlistState) => state.items.length;

/** Adds the product, or updates its remembered colour if it is already saved. */
export function saveToWishlist(
  state: WishlistState,
  productId: string,
  colourId: string | null,
  now: Date,
): WishlistState {
  const existing = findItem(state, productId);
  if (!existing) {
    return { items: [...state.items, { productId, colourId, addedAt: now.toISOString() }] };
  }
  if (existing.colourId === colourId) return state;
  return {
    items: state.items.map((i) => (i.productId === productId ? { ...i, colourId } : i)),
  };
}

export function removeFromWishlist(state: WishlistState, productId: string): WishlistState {
  return findItem(state, productId)
    ? { items: state.items.filter((i) => i.productId !== productId) }
    : state;
}

/** Adds (with colour) when absent, removes when present. */
export function toggleWishlist(
  state: WishlistState,
  productId: string,
  colourId: string | null,
  now: Date,
): { state: WishlistState; saved: boolean } {
  return isInWishlist(state, productId)
    ? { state: removeFromWishlist(state, productId), saved: false }
    : { state: saveToWishlist(state, productId, colourId, now), saved: true };
}

export function setPendingMove(
  state: WishlistState,
  productId: string,
  move: PendingMove,
): WishlistState {
  if (!findItem(state, productId)) return state;
  return {
    items: state.items.map((i) => (i.productId === productId ? { ...i, pendingMove: move } : i)),
  };
}

/** Clears the marker (only when it still belongs to `opId`, if given). */
export function clearPendingMove(
  state: WishlistState,
  productId: string,
  opId?: string,
): WishlistState {
  const item = findItem(state, productId);
  if (!item?.pendingMove || (opId && item.pendingMove.opId !== opId)) return state;
  return {
    items: state.items.map((i) => {
      if (i.productId !== productId) return i;
      const { pendingMove: _cleared, ...rest } = i;
      void _cleared;
      return rest;
    }),
  };
}

/** Operation IDs referenced by unfinished moves (protects journal entries from pruning). */
export function referencedOperationIds(state: WishlistState): Set<string> {
  return new Set(state.items.flatMap((i) => (i.pendingMove ? [i.pendingMove.opId] : [])));
}

// --- Heart and guarded remove (M3.4) -------------------------------------------------------------

/**
 * What the heart (or wishlist row) showed when the customer acted. The change is applied only if
 * the saved item is still in this state — otherwise nothing changes ("changed-elsewhere").
 * - `none`: the product was not saved.
 * - `saved`: the product was saved with this colour (`null` = saved without a colour).
 */
export type WishlistExpectation = { saved: false } | { saved: true; colourId: string | null };

export type HeartOutcome =
  | { kind: "saved"; colourId: string }
  | { kind: "colour-changed"; from: string | null; to: string }
  | { kind: "removed" }
  /** The item no longer matches what the customer saw (another tab changed it). No change. */
  | { kind: "changed-elsewhere" }
  /** The item is part of a move to the bag. No change (the caller recovers moves first). */
  | { kind: "move-pending" };

export type RemoveOutcome =
  { kind: "removed" } | { kind: "changed-elsewhere" } | { kind: "move-pending" };

function matchesExpectation(
  item: WishlistItem | undefined,
  expected: WishlistExpectation,
): boolean {
  if (!expected.saved) return !item;
  return Boolean(item) && item!.colourId === expected.colourId;
}

/**
 * Heart click on a card showing `colourId`:
 * - not saved → save in `colourId`
 * - saved in `colourId` → remove
 * - saved in another colour (or none) → change the saved colour to `colourId` (never a duplicate)
 * Never touches an item that is part of a move, and only applies if `expected` still holds.
 */
export function applyHeart(
  state: WishlistState,
  productId: string,
  colourId: string,
  expected: WishlistExpectation,
  now: Date,
): { state: WishlistState; outcome: HeartOutcome } {
  const item = findItem(state, productId);
  if (item?.pendingMove) return { state, outcome: { kind: "move-pending" } };
  if (!matchesExpectation(item, expected)) return { state, outcome: { kind: "changed-elsewhere" } };
  if (!item) {
    return {
      state: saveToWishlist(state, productId, colourId, now),
      outcome: { kind: "saved", colourId },
    };
  }
  if (item.colourId === colourId) {
    return { state: removeFromWishlist(state, productId), outcome: { kind: "removed" } };
  }
  return {
    state: saveToWishlist(state, productId, colourId, now), // keeps addedAt
    outcome: { kind: "colour-changed", from: item.colourId, to: colourId },
  };
}

/** Wishlist-page Remove: same protections as the heart. */
export function applyRemove(
  state: WishlistState,
  productId: string,
  expected: { colourId: string | null },
): { state: WishlistState; outcome: RemoveOutcome } {
  const item = findItem(state, productId);
  if (item?.pendingMove) return { state, outcome: { kind: "move-pending" } };
  if (!matchesExpectation(item, { saved: true, colourId: expected.colourId })) {
    return { state, outcome: { kind: "changed-elsewhere" } };
  }
  return { state: removeFromWishlist(state, productId), outcome: { kind: "removed" } };
}
