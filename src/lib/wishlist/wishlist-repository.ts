/**
 * WishlistRepository — persistence boundary for the wishlist (browser storage in M3).
 */
import {
  toFailure,
  type RepositoryFailure,
  type SimpleActionResult,
} from "@/lib/cart/cart-repository";
import type { LockManager } from "@/lib/storage/cross-tab-lock";
import {
  createServerSnapshot,
  type PersistentStore,
  type StoreSnapshot,
} from "@/lib/storage/external-store";
import type { WishlistState } from "@/types";

import {
  applyHeart,
  applyRemove,
  removeFromWishlist,
  saveToWishlist,
  toggleWishlist,
  type HeartOutcome,
  type RemoveOutcome,
  type WishlistExpectation,
} from "./wishlist-model";
import { WISHLIST_STORAGE_KEY, wishlistSchema } from "./wishlist-schema";

export type ToggleResult = { ok: true; saved: boolean } | RepositoryFailure;
export type HeartWriteResult = { ok: true; outcome: HeartOutcome } | RepositoryFailure;
export type RemoveWriteResult = { ok: true; outcome: RemoveOutcome } | RepositoryFailure;

export const WISHLIST_SERVER_SNAPSHOT: StoreSnapshot<WishlistState> =
  createServerSnapshot(wishlistSchema);

export interface WishlistRepository {
  readonly store: PersistentStore<WishlistState>;
  subscribe(listener: () => void): () => void;
  getSnapshot(): StoreSnapshot<WishlistState>;
  /** Adds the product or updates its remembered colour. */
  save(productId: string, colourId: string | null): Promise<SimpleActionResult>;
  remove(productId: string): Promise<SimpleActionResult>;
  toggle(productId: string, colourId: string | null): Promise<ToggleResult>;
}

export class LocalWishlistRepository implements WishlistRepository {
  constructor(
    readonly store: PersistentStore<WishlistState>,
    private readonly locks: LockManager,
    private readonly now: () => Date = () => new Date(),
  ) {}

  subscribe = (listener: () => void) => this.store.subscribe(listener);
  getSnapshot = () => this.store.getSnapshot();

  private async simple(fn: (state: WishlistState) => WishlistState): Promise<SimpleActionResult> {
    try {
      await this.locks.run(WISHLIST_STORAGE_KEY, () =>
        this.store.mutateNow((data) => ({ data: fn(data), result: undefined })),
      );
      return { ok: true };
    } catch (error) {
      return toFailure(error);
    }
  }

  save(productId: string, colourId: string | null) {
    return this.simple((s) => saveToWishlist(s, productId, colourId, this.now()));
  }

  remove(productId: string) {
    return this.simple((s) => removeFromWishlist(s, productId));
  }

  async toggle(productId: string, colourId: string | null): Promise<ToggleResult> {
    try {
      const saved = await this.locks.run(WISHLIST_STORAGE_KEY, () =>
        this.store.mutateNow((data) => {
          const { state, saved: nowSaved } = toggleWishlist(data, productId, colourId, this.now());
          return { data: state, result: nowSaved };
        }),
      );
      return { ok: true, saved };
    } catch (error) {
      return toFailure(error);
    }
  }

  /**
   * Guarded heart write (M3.4): under the wishlist lock, on the latest saved data. Applies only if
   * the item still matches `expected` and is not part of a move (see applyHeart).
   */
  async applyHeart(
    productId: string,
    colourId: string,
    expected: WishlistExpectation,
  ): Promise<HeartWriteResult> {
    try {
      const outcome = await this.locks.run(WISHLIST_STORAGE_KEY, () =>
        this.store.mutateNow((data) => {
          const update = applyHeart(data, productId, colourId, expected, this.now());
          return { data: update.state, result: update.outcome };
        }),
      );
      return { ok: true, outcome };
    } catch (error) {
      return toFailure(error);
    }
  }

  /** Guarded wishlist-page Remove (same protections as the heart). */
  async applyRemove(
    productId: string,
    expected: { colourId: string | null },
  ): Promise<RemoveWriteResult> {
    try {
      const outcome = await this.locks.run(WISHLIST_STORAGE_KEY, () =>
        this.store.mutateNow((data) => {
          const update = applyRemove(data, productId, expected);
          return { data: update.state, result: update.outcome };
        }),
      );
      return { ok: true, outcome };
    } catch (error) {
      return toFailure(error);
    }
  }
}
