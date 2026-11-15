/**
 * Wires the cart & wishlist repositories, storage adapter and cross-tab locks together.
 * `getShoppingSession()` returns one shared session per browser tab (null during server
 * rendering); `createShoppingSession()` is the injectable factory used by tests.
 */
import { CART_SERVER_SNAPSHOT, LocalCartRepository } from "@/lib/cart/cart-repository";
import { normaliseOperations, type VariantAvailability } from "@/lib/cart/cart-model";
import { cartSchema } from "@/lib/cart/cart-schema";
import { createId } from "@/lib/create-id";
import { getLockManager, type LockManager } from "@/lib/storage/cross-tab-lock";
import { PersistentStore } from "@/lib/storage/external-store";
import { MemoryStorageAdapter } from "@/lib/storage/memory-storage-adapter";
import type { StorageAdapter } from "@/lib/storage/storage-adapter";
import { getBrowserStorageAdapter } from "@/lib/storage/web-storage-adapter";
import {
  finishPendingMove,
  moveWishlistItemToCart,
  type MoveResult,
} from "@/lib/wishlist/move-to-cart";
import {
  safeHeart,
  safeRemove,
  type SafeHeartResult,
  type SafeRemoveResult,
} from "@/lib/wishlist/heart-action";
import { referencedOperationIds, type WishlistExpectation } from "@/lib/wishlist/wishlist-model";
import {
  LocalWishlistRepository,
  WISHLIST_SERVER_SNAPSHOT,
} from "@/lib/wishlist/wishlist-repository";
import { wishlistSchema } from "@/lib/wishlist/wishlist-schema";
import type { CartState, WishlistState } from "@/types";

export { CART_SERVER_SNAPSHOT, WISHLIST_SERVER_SNAPSHOT };

export interface ShoppingSession {
  cart: LocalCartRepository;
  wishlist: LocalWishlistRepository;
  locks: LockManager;
  tabId: string;
  moveToCart(productId: string, variant: VariantAvailability | null): Promise<MoveResult>;
  finishMove(productId: string): Promise<MoveResult>;
  /** Heart click (M3.4): recovers an interrupted move first, then a guarded write. */
  heart(
    productId: string,
    colourId: string,
    expected: WishlistExpectation,
  ): Promise<SafeHeartResult>;
  /** Wishlist-page Remove (M3.4): same protection as the heart. */
  safeRemove(productId: string, expected: { colourId: string | null }): Promise<SafeRemoveResult>;
}

export interface SessionOptions {
  adapter: StorageAdapter | null;
  locks: LockManager;
  now?: () => Date;
  random?: () => number;
  createId?: () => string;
  leaseMs?: number;
  lockTimeoutMs?: number;
}

/** A tab identifier that never throws (falls back to a time-based value). */
function safeTabId(generate: () => string): string {
  try {
    return `tab-${generate()}`;
  } catch {
    return `tab-${Date.now().toString(36)}`;
  }
}

export function createShoppingSession(options: SessionOptions): ShoppingSession {
  const now = options.now ?? (() => new Date());
  const generateId = options.createId ?? (() => createId());

  const wishlistStore = new PersistentStore<WishlistState>(wishlistSchema, options.adapter, {
    now,
    random: options.random,
  });

  // Before each cart save: complete journal entries no wishlist move references any more (only
  // when the wishlist is reliably readable) and cap completed entries.
  const cartStore = new PersistentStore<CartState>(cartSchema, options.adapter, {
    now,
    random: options.random,
    beforeWrite: (state) => {
      const wishlist = wishlistStore.readFresh();
      const referenced = wishlistStore.isReliable() ? referencedOperationIds(wishlist) : null;
      return normaliseOperations(state, referenced);
    },
  });

  const tabId = safeTabId(generateId);
  const moveDeps = {
    cart: cartStore,
    wishlist: wishlistStore,
    locks: options.locks,
    tabId,
    createId: generateId,
    now,
    leaseMs: options.leaseMs,
    lockTimeoutMs: options.lockTimeoutMs,
  };

  const wishlist = new LocalWishlistRepository(wishlistStore, options.locks, now);
  const finishMove = (productId: string) => finishPendingMove(moveDeps, productId);
  const safeDeps = { wishlist, finishMove };

  return {
    cart: new LocalCartRepository(cartStore, options.locks, now),
    wishlist,
    locks: options.locks,
    tabId,
    moveToCart: (productId, variant) => moveWishlistItemToCart(moveDeps, { productId, variant }),
    finishMove,
    heart: (productId, colourId, expected) => safeHeart(safeDeps, productId, colourId, expected),
    safeRemove: (productId, expected) => safeRemove(safeDeps, productId, expected),
  };
}

/**
 * Holds the single shared session for this tab.
 * - `peek()` never creates anything (safe to call while React renders).
 * - `get()` creates the session on first use — call it only from effects, subscriptions or
 *   event handlers, never during render (creation reads, and may repair, browser storage).
 */
export interface SessionHost {
  peek(): ShoppingSession | null;
  get(): ShoppingSession | null;
}

export function createSessionHost(options: {
  isBrowser: () => boolean;
  create: () => ShoppingSession;
}): SessionHost {
  let session: ShoppingSession | null = null;
  return {
    peek: () => session,
    get: () => {
      if (!options.isBrowser()) return null;
      if (!session) session = options.create();
      return session;
    },
  };
}

const browserHost = createSessionHost({
  isBrowser: () => typeof window !== "undefined",
  create: () =>
    createShoppingSession({
      // Browser storage when usable; otherwise a session-only MemoryStorageAdapter.
      adapter: getBrowserStorageAdapter() ?? new MemoryStorageAdapter(),
      locks: getLockManager(),
    }),
});

/** The shared browser session (created on first use), or null on the server. Never throws. */
export const getShoppingSession = (): ShoppingSession | null => browserHost.get();

/** The shared browser session if it already exists — never creates it (render-safe). */
export const peekShoppingSession = (): ShoppingSession | null => browserHost.peek();

export { browserHost };
