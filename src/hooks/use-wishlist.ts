"use client";

import { useSyncExternalStore } from "react";

import type { VariantAvailability } from "@/lib/cart/cart-model";
import type { SimpleActionResult } from "@/lib/cart/cart-repository";
import { getShoppingSession } from "@/lib/shopping/session";
import { wishlistBindings } from "@/lib/shopping/store-bindings";
import type { SafeHeartResult, SafeRemoveResult } from "@/lib/wishlist/heart-action";
import type { MoveResult } from "@/lib/wishlist/move-to-cart";
import { countItems, findItem, type WishlistExpectation } from "@/lib/wishlist/wishlist-model";
import type { ToggleResult } from "@/lib/wishlist/wishlist-repository";

const unavailable = { ok: false, reason: "storage_error" } as const;
const moveUnavailable: MoveResult = { status: "failed", reason: "storage_error" };

/**
 * Wishlist actions. Defined once at module level, so their identity is stable across renders
 * (safe to use as effect dependencies). None of them reads the render-time snapshot.
 */
const actions = {
  save: (productId: string, colourId: string | null): Promise<SimpleActionResult> =>
    getShoppingSession()?.wishlist.save(productId, colourId) ?? Promise.resolve(unavailable),
  remove: (productId: string): Promise<SimpleActionResult> =>
    getShoppingSession()?.wishlist.remove(productId) ?? Promise.resolve(unavailable),
  toggle: (productId: string, colourId: string | null): Promise<ToggleResult> =>
    getShoppingSession()?.wishlist.toggle(productId, colourId) ?? Promise.resolve(unavailable),
  moveToCart: (productId: string, variant: VariantAvailability | null): Promise<MoveResult> =>
    getShoppingSession()?.moveToCart(productId, variant) ?? Promise.resolve(moveUnavailable),
  finishMove: (productId: string): Promise<MoveResult> =>
    getShoppingSession()?.finishMove(productId) ?? Promise.resolve(moveUnavailable),
  /** Heart click (M3.4): recovers an interrupted move first, then applies only if unchanged. */
  heart: (
    productId: string,
    colourId: string,
    expected: WishlistExpectation,
  ): Promise<SafeHeartResult> =>
    getShoppingSession()?.heart(productId, colourId, expected) ?? Promise.resolve(unavailable),
  /** Wishlist-page Remove (M3.4): same protection as the heart. */
  safeRemove: (
    productId: string,
    expected: { colourId: string | null },
  ): Promise<SafeRemoveResult> =>
    getShoppingSession()?.safeRemove(productId, expected) ?? Promise.resolve(unavailable),
  /** Whether the wishlist is CURRENTLY saved in browser storage (read after an action). */
  isPersisted: (): boolean => getShoppingSession()?.wishlist.getSnapshot().persistent ?? false,
};

/** Wishlist state + actions. Hydration-safe and render-pure (see useCart). */
export function useWishlist() {
  const snapshot = useSyncExternalStore(
    wishlistBindings.subscribe,
    wishlistBindings.getSnapshot,
    wishlistBindings.getServerSnapshot,
  );
  return {
    ...snapshot,
    count: countItems(snapshot.data),
    isSaved: (productId: string) => Boolean(findItem(snapshot.data, productId)),
    ...actions,
  };
}
