/**
 * Wishlist → Cart move, coordinated across tabs.
 *
 * The cart and wishlist are separate storage keys; localStorage cannot update both atomically, so
 * the move is made idempotent and recoverable rather than "transactional":
 *
 * - The WHOLE move runs while holding both locks, always acquired in the order
 *   "jygs:cart" → "jygs:wishlist" (every other operation takes a single lock → no deadlocks).
 * - Steps (each re-reads storage first, all synchronous inside the critical section):
 *     R  recover an interrupted move for this item
 *     1  mark the wishlist item with pendingMove { opId, variantId, owner, lease }
 *     2  add to cart unless the journal already has opId; journal { opId, completed: false }
 *     3  remove the wishlist item
 *     4  mark the journal entry completed (best effort; housekeeping repairs failures)
 * - "moved" is reported only when steps 2 and 3 both succeed.
 * - With Web Locks, a pendingMove found while holding both locks is always an interrupted move.
 *   Without Web Locks, an unexpired lease owned by another tab is treated as in progress, and a
 *   write-then-verify check detects most simultaneous starts (a small race window remains).
 */
import {
  addToCart,
  completeOperation,
  hasOperation,
  type CartChangeRefusal,
  type VariantAvailability,
} from "@/lib/cart/cart-model";
import { CART_STORAGE_KEY } from "@/lib/cart/cart-schema";
import { LockTimeoutError, type LockManager } from "@/lib/storage/cross-tab-lock";
import type { PersistentStore } from "@/lib/storage/external-store";
import type { CartState, PendingMove, WishlistState } from "@/types";

import { clearPendingMove, findItem, removeFromWishlist, setPendingMove } from "./wishlist-model";
import { WISHLIST_STORAGE_KEY } from "./wishlist-schema";

export const MOVE_LEASE_MS = 15_000;

export type MoveFailureReason =
  CartChangeRefusal | "id_generation" | "lock_timeout" | "storage_error";

export type MoveResult =
  /** Added to the cart AND removed from the wishlist. */
  | { status: "moved"; finishedPrevious: boolean }
  /** The item is no longer in the wishlist (e.g. another tab already moved it). Nothing added. */
  | { status: "already-moved" }
  /** Added to the cart, but the wishlist item could not be removed (it is kept, marked pending). */
  | { status: "partial" }
  /** Another tab is moving this item right now (no-lock fallback only). Nothing changed. */
  | { status: "in-progress" }
  /** Nothing was added; the wishlist item is kept. */
  | { status: "failed"; reason: MoveFailureReason };

export interface MoveDependencies {
  cart: PersistentStore<CartState>;
  wishlist: PersistentStore<WishlistState>;
  locks: LockManager;
  /** Identifies this tab as the owner of a pending move. */
  tabId: string;
  createId: () => string;
  now?: () => Date;
  leaseMs?: number;
  lockTimeoutMs?: number;
}

export interface MoveRequest {
  productId: string;
  /** The chosen variant (colour + size) with its current availability; null if none chosen/found. */
  variant: VariantAvailability | null;
}

/** Runs `fn` holding both locks in the fixed order cart → wishlist. */
function withBothLocks<T>(deps: MoveDependencies, fn: () => T): Promise<T> {
  const options = { timeoutMs: deps.lockTimeoutMs };
  return deps.locks.run(
    CART_STORAGE_KEY,
    () => deps.locks.run(WISHLIST_STORAGE_KEY, fn, options),
    options,
  );
}

function bestEffort(fn: () => void): void {
  try {
    fn();
  } catch {
    // housekeeping only — repaired on a later write
  }
}

/** Steps R–4, synchronous; must run while holding both locks. */
function runMove(deps: MoveDependencies, request: MoveRequest): MoveResult {
  const now = (deps.now ?? (() => new Date()))();
  const { cart, wishlist } = deps;
  const { productId } = request;

  const item = findItem(wishlist.readFresh(), productId);
  if (!item) return { status: "already-moved" };

  // --- R: recovery of an earlier, unfinished move -----------------------------------------
  if (item.pendingMove) {
    const pending = item.pendingMove;
    const inProgressElsewhere =
      !deps.locks.exclusive &&
      pending.owner !== deps.tabId &&
      Date.parse(pending.leaseExpiresAt) > now.getTime();
    if (inProgressElsewhere) return { status: "in-progress" };

    if (hasOperation(cart.readFresh(), pending.opId)) {
      // The cart add already happened: only finish the wishlist removal. Never add again.
      try {
        wishlist.mutateNow((s) => ({ data: removeFromWishlist(s, productId), result: undefined }), {
          strict: true,
        });
      } catch {
        return { status: "partial" };
      }
      bestEffort(() =>
        cart.mutateNow((s) => ({ data: completeOperation(s, pending.opId), result: undefined })),
      );
      return { status: "moved", finishedPrevious: true };
    }
    // The add never happened: the stale marker is cleared and a fresh move proceeds.
    try {
      wishlist.mutateNow(
        (s) => ({ data: clearPendingMove(s, productId, pending.opId), result: undefined }),
        {
          strict: true,
        },
      );
    } catch {
      return { status: "failed", reason: "storage_error" };
    }
  }

  // Pre-check availability before writing anything.
  const variant = request.variant;
  const preview = addToCart(cart.readFresh(), variant, 1, now);
  if (!preview.change.ok) return { status: "failed", reason: preview.change.reason };
  if (!variant) return { status: "failed", reason: "unavailable" };

  let opId: string;
  try {
    opId = deps.createId();
  } catch {
    return { status: "failed", reason: "id_generation" };
  }

  // --- 1: mark the wishlist item -------------------------------------------------------------
  const marker: PendingMove = {
    opId,
    variantId: variant.variantId,
    owner: deps.tabId,
    startedAt: now.toISOString(),
    leaseExpiresAt: new Date(now.getTime() + (deps.leaseMs ?? MOVE_LEASE_MS)).toISOString(),
  };
  try {
    wishlist.mutateNow((s) => ({ data: setPendingMove(s, productId, marker), result: undefined }), {
      strict: true,
    });
  } catch {
    return { status: "failed", reason: "storage_error" };
  }
  if (
    !deps.locks.exclusive &&
    findItem(wishlist.readFresh(), productId)?.pendingMove?.opId !== opId
  ) {
    return { status: "in-progress" }; // another tab claimed it first (write-then-verify)
  }

  const clearMarker = () =>
    bestEffort(() =>
      wishlist.mutateNow(
        (s) => ({ data: clearPendingMove(s, productId, opId), result: undefined }),
        { strict: true },
      ),
    );

  // --- 2: add to the cart (idempotent by opId) ---------------------------------------------
  type AddOutcome = { ok: true } | { ok: false; reason: CartChangeRefusal };
  let added: AddOutcome;
  try {
    added = cart.mutateNow<AddOutcome>(
      (s) => {
        if (hasOperation(s, opId)) return { data: s, result: { ok: true } };
        const update = addToCart(s, variant, 1, now, opId);
        return { data: update.state, result: update.change };
      },
      { strict: true },
    );
  } catch {
    clearMarker();
    return { status: "failed", reason: "storage_error" };
  }
  if (!added.ok) {
    clearMarker();
    return { status: "failed", reason: added.reason };
  }

  // --- 3: remove from the wishlist -----------------------------------------------------------
  try {
    wishlist.mutateNow((s) => ({ data: removeFromWishlist(s, productId), result: undefined }), {
      strict: true,
    });
  } catch {
    return { status: "partial" };
  }

  // --- 4: complete the journal entry -------------------------------------------------------
  bestEffort(() =>
    cart.mutateNow((s) => ({ data: completeOperation(s, opId), result: undefined })),
  );
  return { status: "moved", finishedPrevious: false };
}

/** Moves a wishlist item to the cart. Never throws. */
export async function moveWishlistItemToCart(
  deps: MoveDependencies,
  request: MoveRequest,
): Promise<MoveResult> {
  try {
    return await withBothLocks(deps, () => runMove(deps, request));
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof LockTimeoutError ? "lock_timeout" : "storage_error",
    };
  }
}

/**
 * Finishes an interrupted move ("Remove from wishlist" / "Finish moving"): if the cart add already
 * happened, only removes the wishlist item; otherwise clears the stale marker. Never adds to cart.
 */
export async function finishPendingMove(
  deps: MoveDependencies,
  productId: string,
): Promise<MoveResult> {
  try {
    return await withBothLocks(deps, () => {
      const now = (deps.now ?? (() => new Date()))();
      const item = findItem(deps.wishlist.readFresh(), productId);
      if (!item) return { status: "already-moved" } as const;
      const pending = item.pendingMove;
      if (!pending) return { status: "failed", reason: "not_in_cart" } as const;
      const inProgressElsewhere =
        !deps.locks.exclusive &&
        pending.owner !== deps.tabId &&
        Date.parse(pending.leaseExpiresAt) > now.getTime();
      if (inProgressElsewhere) return { status: "in-progress" } as const;
      if (!hasOperation(deps.cart.readFresh(), pending.opId)) {
        deps.wishlist.mutateNow(
          (s) => ({ data: clearPendingMove(s, productId, pending.opId), result: undefined }),
          {
            strict: true,
          },
        );
        return { status: "failed", reason: "not_in_cart" } as const;
      }
      try {
        deps.wishlist.mutateNow(
          (s) => ({ data: removeFromWishlist(s, productId), result: undefined }),
          { strict: true },
        );
      } catch {
        return { status: "partial" } as const;
      }
      bestEffort(() =>
        deps.cart.mutateNow((s) => ({
          data: completeOperation(s, pending.opId),
          result: undefined,
        })),
      );
      return { status: "moved", finishedPrevious: true } as const;
    });
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof LockTimeoutError ? "lock_timeout" : "storage_error",
    };
  }
}
