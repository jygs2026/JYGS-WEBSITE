"use client";

import { useSyncExternalStore } from "react";

import { countUnits, type VariantAvailability } from "@/lib/cart/cart-model";
import type { CartActionResult, SimpleActionResult } from "@/lib/cart/cart-repository";
import { getShoppingSession } from "@/lib/shopping/session";
import { cartBindings } from "@/lib/shopping/store-bindings";

const unavailable = { ok: false, reason: "storage_error" } as const;

/**
 * Cart state + actions. Hydration-safe: during server rendering and hydration `ready` is false
 * (render a neutral placeholder, never "empty"); the stored cart appears right after hydration.
 * Rendering never creates the session or touches storage (see store-bindings); actions run only
 * from event handlers.
 */
export function useCart() {
  const snapshot = useSyncExternalStore(
    cartBindings.subscribe,
    cartBindings.getSnapshot,
    cartBindings.getServerSnapshot,
  );
  return {
    ...snapshot,
    /** Stored units (header badge). */
    units: countUnits(snapshot.data),
    /**
     * Whether the bag is CURRENTLY saved in browser storage (read after an action: a failed write
     * switches the bag to this-visit-only memory, per the M3.1 storage rules).
     */
    isPersisted: (): boolean => getShoppingSession()?.cart.getSnapshot().persistent ?? false,
    add: (variant: VariantAvailability | null, quantity = 1): Promise<CartActionResult> =>
      getShoppingSession()?.cart.add(variant, quantity) ?? Promise.resolve(unavailable),
    setQuantity: (
      variantId: string,
      quantity: number,
      variant: VariantAvailability | null,
    ): Promise<CartActionResult> =>
      getShoppingSession()?.cart.setQuantity(variantId, quantity, variant) ??
      Promise.resolve(unavailable),
    acknowledgeAvailability: (
      variantId: string,
      variant: VariantAvailability | null,
    ): Promise<CartActionResult> =>
      getShoppingSession()?.cart.acknowledgeAvailability(variantId, variant) ??
      Promise.resolve(unavailable),
    remove: (variantId: string): Promise<SimpleActionResult> =>
      getShoppingSession()?.cart.remove(variantId) ?? Promise.resolve(unavailable),
    clear: (): Promise<SimpleActionResult> =>
      getShoppingSession()?.cart.clear() ?? Promise.resolve(unavailable),
  };
}
