/**
 * Safe heart / Remove sequence (M3.4). A heart click or wishlist-page Remove must never change an
 * item while it is part of a move to the bag:
 *
 * 1. If the item carries a move marker, the existing M3.1 recovery (`finishMove`) runs first.
 *    It takes the cart lock, then the wishlist lock (the fixed order) and never adds to the bag:
 *    - the earlier add reached the bag → the wishlist item is removed → "already-moved"
 *    - the add never happened → only the marker is cleared → continue to step 2
 *    - another tab is still moving it (no-Web-Locks fallback, valid lease) → "move-in-progress"
 *    - recovery could not finish → failure, nothing else changes
 * 2. The guarded write runs under the wishlist lock on the latest saved data and applies only if
 *    the item still matches what the customer saw and carries no move marker.
 *
 * With Web Locks a running move holds both locks, so step 2 waits for it and then sees the change
 * (no action). Without Web Locks, another tab's running move is detected by its lease.
 */
import type { RepositoryFailure } from "@/lib/cart/cart-repository";

import type { MoveResult } from "./move-to-cart";
import {
  findItem,
  type HeartOutcome,
  type RemoveOutcome,
  type WishlistExpectation,
} from "./wishlist-model";
import type { LocalWishlistRepository } from "./wishlist-repository";

type RecoveryOutcome = { kind: "already-moved" } | { kind: "move-in-progress" };

export type SafeHeartOutcome = Exclude<HeartOutcome, { kind: "move-pending" }> | RecoveryOutcome;
export type SafeRemoveOutcome = Exclude<RemoveOutcome, { kind: "move-pending" }> | RecoveryOutcome;

export type SafeHeartResult = { ok: true; outcome: SafeHeartOutcome } | RepositoryFailure;
export type SafeRemoveResult = { ok: true; outcome: SafeRemoveOutcome } | RepositoryFailure;

export interface SafeWishlistDependencies {
  wishlist: LocalWishlistRepository;
  /** M3.1 recovery of an interrupted move (never adds to the bag). */
  finishMove: (productId: string) => Promise<MoveResult>;
}

type Recovery =
  | { proceed: true }
  | {
      proceed: false;
      result: { ok: true; outcome: RecoveryOutcome | { kind: "changed-elsewhere" } };
    }
  | { proceed: false; result: RepositoryFailure };

/** Step 1: recover a marked item before anything else touches it. */
async function recoverFirst(deps: SafeWishlistDependencies, productId: string): Promise<Recovery> {
  const item = findItem(deps.wishlist.store.readFresh(), productId);
  if (!item?.pendingMove) return { proceed: true };

  const result = await deps.finishMove(productId);
  switch (result.status) {
    case "moved":
      return { proceed: false, result: { ok: true, outcome: { kind: "already-moved" } } };
    case "already-moved":
      // The item disappeared meanwhile (moved or removed in another tab): nothing to do.
      return { proceed: false, result: { ok: true, outcome: { kind: "changed-elsewhere" } } };
    case "in-progress":
      return { proceed: false, result: { ok: true, outcome: { kind: "move-in-progress" } } };
    case "partial":
      return { proceed: false, result: { ok: false, reason: "storage_error" } };
    case "failed":
      // "not_in_cart": the earlier add never happened and the marker was cleared → continue.
      if (result.reason === "not_in_cart") return { proceed: true };
      return {
        proceed: false,
        result: {
          ok: false,
          reason: result.reason === "lock_timeout" ? "lock_timeout" : "storage_error",
        },
      };
  }
}

/** A marker that appeared between recovery and the write: treated as a move in progress. */
const asSafe = <T extends { kind: string }>(outcome: T) =>
  outcome.kind === "move-pending" ? ({ kind: "move-in-progress" } as const) : outcome;

export async function safeHeart(
  deps: SafeWishlistDependencies,
  productId: string,
  colourId: string,
  expected: WishlistExpectation,
): Promise<SafeHeartResult> {
  const recovery = await recoverFirst(deps, productId);
  if (!recovery.proceed) return recovery.result;
  const result = await deps.wishlist.applyHeart(productId, colourId, expected);
  return result.ok ? { ok: true, outcome: asSafe(result.outcome) as SafeHeartOutcome } : result;
}

export async function safeRemove(
  deps: SafeWishlistDependencies,
  productId: string,
  expected: { colourId: string | null },
): Promise<SafeRemoveResult> {
  const recovery = await recoverFirst(deps, productId);
  if (!recovery.proceed) return recovery.result;
  const result = await deps.wishlist.applyRemove(productId, expected);
  return result.ok ? { ok: true, outcome: asSafe(result.outcome) as SafeRemoveOutcome } : result;
}
