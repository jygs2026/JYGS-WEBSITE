/**
 * CartRepository — the persistence boundary for the cart. M3 ships LocalCartRepository (browser
 * storage); a future server-backed repository can implement the same interface.
 */
import { LockTimeoutError, type LockManager } from "@/lib/storage/cross-tab-lock";
import {
  createServerSnapshot,
  type PersistentStore,
  type StoreSnapshot,
} from "@/lib/storage/external-store";
import type { CartState } from "@/types";

import {
  acknowledgeAvailability,
  addToCart,
  clearCart,
  removeLine,
  setLineQuantity,
  type CartChange,
  type VariantAvailability,
} from "./cart-model";
import { CART_STORAGE_KEY, cartSchema } from "./cart-schema";

export type RepositoryFailure = { ok: false; reason: "lock_timeout" | "storage_error" };
export type CartActionResult = CartChange | RepositoryFailure;
export type SimpleActionResult = { ok: true } | RepositoryFailure;

export const CART_SERVER_SNAPSHOT: StoreSnapshot<CartState> = createServerSnapshot(cartSchema);

export interface CartRepository {
  /** Low-level store (for coordinated workflows that already hold the cart lock). */
  readonly store: PersistentStore<CartState>;
  subscribe(listener: () => void): () => void;
  getSnapshot(): StoreSnapshot<CartState>;
  add(variant: VariantAvailability | null, quantity?: number): Promise<CartActionResult>;
  setQuantity(
    variantId: string,
    quantity: number,
    variant: VariantAvailability | null,
  ): Promise<CartActionResult>;
  /** Saves the displayed (availability-reduced) quantity after the customer confirms it. */
  acknowledgeAvailability(
    variantId: string,
    variant: VariantAvailability | null,
  ): Promise<CartActionResult>;
  remove(variantId: string): Promise<SimpleActionResult>;
  clear(): Promise<SimpleActionResult>;
}

export function toFailure(error: unknown): RepositoryFailure {
  return {
    ok: false,
    reason: error instanceof LockTimeoutError ? "lock_timeout" : "storage_error",
  };
}

export class LocalCartRepository implements CartRepository {
  constructor(
    readonly store: PersistentStore<CartState>,
    private readonly locks: LockManager,
    private readonly now: () => Date = () => new Date(),
  ) {}

  subscribe = (listener: () => void) => this.store.subscribe(listener);
  getSnapshot = () => this.store.getSnapshot();

  private async change(
    fn: (state: CartState) => { state: CartState; change: CartChange },
  ): Promise<CartActionResult> {
    try {
      return await this.locks.run(CART_STORAGE_KEY, () =>
        this.store.mutateNow((data) => {
          const { state, change } = fn(data);
          return { data: state, result: change };
        }),
      );
    } catch (error) {
      return toFailure(error);
    }
  }

  private async simple(fn: (state: CartState) => CartState): Promise<SimpleActionResult> {
    try {
      await this.locks.run(CART_STORAGE_KEY, () =>
        this.store.mutateNow((data) => ({ data: fn(data), result: undefined })),
      );
      return { ok: true };
    } catch (error) {
      return toFailure(error);
    }
  }

  add(variant: VariantAvailability | null, quantity = 1) {
    return this.change((s) => addToCart(s, variant, quantity, this.now()));
  }

  setQuantity(variantId: string, quantity: number, variant: VariantAvailability | null) {
    return this.change((s) => setLineQuantity(s, variantId, quantity, variant));
  }

  acknowledgeAvailability(variantId: string, variant: VariantAvailability | null) {
    return this.change((s) => acknowledgeAvailability(s, variantId, variant));
  }

  remove(variantId: string) {
    return this.simple((s) => removeLine(s, variantId));
  }

  clear() {
    return this.simple(clearCart);
  }
}
