/**
 * Pure cart business logic (no React, no storage). Every function returns a NEW state object when
 * something changes and the SAME object when nothing changes.
 *
 * Rules (approved M3 scope):
 * - One line per variant; adding the same variant increases its quantity.
 * - Different size or colour = different variant = separate line.
 * - Line limit = min(10, available demo stock). Adds that would exceed it are refused (no partial add).
 * - Sold-out / inactive / unknown variants cannot be added.
 */
import type { CartLine, CartOperation, CartState } from "@/types";

export const MAX_QUANTITY_PER_LINE = 10;
/** Completed journal entries kept; unfinished entries are never pruned while referenced. */
export const MAX_COMPLETED_OPERATIONS = 50;

/** Current availability of one variant, supplied from the catalogue (never from storage). */
export interface VariantAvailability {
  variantId: string;
  productId: string;
  /** Available demo stock (whole number ≥ 0). */
  available: number;
  isActive: boolean;
}

export type VariantLookup = (variantId: string) => VariantAvailability | null;

export type CartChangeRefusal =
  "unavailable" | "sold_out" | "limit_reached" | "invalid_quantity" | "not_in_cart";

export type CartChange =
  | { ok: true; quantity: number; limit: number }
  | { ok: false; reason: CartChangeRefusal; quantity: number; limit: number };

export interface CartUpdate {
  state: CartState;
  change: CartChange;
}

export const emptyCart = (): CartState => ({ lines: [], ops: [] });

/** Maximum quantity allowed for a line of this variant right now. */
export function lineLimit(variant: VariantAvailability | null): number {
  if (!variant || !variant.isActive) return 0;
  return Math.max(0, Math.min(MAX_QUANTITY_PER_LINE, Math.floor(variant.available)));
}

const isWholePositive = (n: number) => Number.isInteger(n) && n >= 1;

function refusal(variant: VariantAvailability | null): CartChangeRefusal {
  return !variant || !variant.isActive ? "unavailable" : "sold_out";
}

export function findLine(state: CartState, variantId: string): CartLine | undefined {
  return state.lines.find((l) => l.variantId === variantId);
}

export function countUnits(state: CartState): number {
  return state.lines.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Adds `quantity` of a variant. When `opId` is given the add is recorded in the operation journal
 * (unfinished) — used by the Wishlist → Cart move for idempotency.
 */
export function addToCart(
  state: CartState,
  variant: VariantAvailability | null,
  quantity: number,
  now: Date,
  opId?: string,
): CartUpdate {
  const limit = lineLimit(variant);
  const existing = variant ? findLine(state, variant.variantId) : undefined;
  const current = existing?.quantity ?? 0;

  if (!isWholePositive(quantity)) {
    return { state, change: { ok: false, reason: "invalid_quantity", quantity: current, limit } };
  }
  if (!variant || limit === 0) {
    return { state, change: { ok: false, reason: refusal(variant), quantity: current, limit } };
  }
  if (current + quantity > limit) {
    return { state, change: { ok: false, reason: "limit_reached", quantity: current, limit } };
  }

  const at = now.toISOString();
  const lines = existing
    ? state.lines.map((l) =>
        l.variantId === variant.variantId ? { ...l, quantity: current + quantity } : l,
      )
    : [
        ...state.lines,
        { variantId: variant.variantId, productId: variant.productId, quantity, addedAt: at },
      ];
  const ops: CartOperation[] = opId
    ? [...state.ops, { opId, variantId: variant.variantId, completed: false, at }]
    : state.ops;

  return { state: { lines, ops }, change: { ok: true, quantity: current + quantity, limit } };
}

/** Sets a line's quantity (1…limit). Use removeLine to delete. */
export function setLineQuantity(
  state: CartState,
  variantId: string,
  quantity: number,
  variant: VariantAvailability | null,
): CartUpdate {
  const existing = findLine(state, variantId);
  const limit = lineLimit(variant);
  if (!existing) return { state, change: { ok: false, reason: "not_in_cart", quantity: 0, limit } };
  if (!isWholePositive(quantity)) {
    return {
      state,
      change: { ok: false, reason: "invalid_quantity", quantity: existing.quantity, limit },
    };
  }
  if (limit === 0) {
    return {
      state,
      change: { ok: false, reason: refusal(variant), quantity: existing.quantity, limit },
    };
  }
  if (quantity > limit) {
    return {
      state,
      change: { ok: false, reason: "limit_reached", quantity: existing.quantity, limit },
    };
  }
  if (quantity === existing.quantity) return { state, change: { ok: true, quantity, limit } };
  return {
    state: {
      ...state,
      lines: state.lines.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)),
    },
    change: { ok: true, quantity, limit },
  };
}

/**
 * Customer acknowledgement of an availability update: saves the displayed (reduced) quantity.
 * Never removes the line — sold-out / unavailable lines are only removed by the customer.
 */
export function acknowledgeAvailability(
  state: CartState,
  variantId: string,
  variant: VariantAvailability | null,
): CartUpdate {
  const existing = findLine(state, variantId);
  const limit = lineLimit(variant);
  if (!existing) return { state, change: { ok: false, reason: "not_in_cart", quantity: 0, limit } };
  if (limit === 0) {
    return {
      state,
      change: { ok: false, reason: refusal(variant), quantity: existing.quantity, limit },
    };
  }
  return existing.quantity > limit
    ? setLineQuantity(state, variantId, limit, variant)
    : { state, change: { ok: true, quantity: existing.quantity, limit } };
}

export function removeLine(state: CartState, variantId: string): CartState {
  return findLine(state, variantId)
    ? { ...state, lines: state.lines.filter((l) => l.variantId !== variantId) }
    : state;
}

/** Removes all lines. The operation journal is kept so idempotency protection survives. */
export function clearCart(state: CartState): CartState {
  return state.lines.length === 0 ? state : { ...state, lines: [] };
}

// --- Operation journal -------------------------------------------------------------------------

export function hasOperation(state: CartState, opId: string): boolean {
  return state.ops.some((op) => op.opId === opId);
}

export function completeOperation(state: CartState, opId: string): CartState {
  const op = state.ops.find((o) => o.opId === opId);
  if (!op || op.completed) return state;
  return { ...state, ops: state.ops.map((o) => (o.opId === opId ? { ...o, completed: true } : o)) };
}

/**
 * Journal housekeeping before every save:
 * - Unfinished entries no longer referenced by any wishlist pendingMove are marked complete
 *   (only when the references are reliably known — pass null when unknown).
 * - Unfinished entries are always kept; completed entries are capped at MAX_COMPLETED_OPERATIONS
 *   (most recent kept).
 */
export function normaliseOperations(
  state: CartState,
  referenced: ReadonlySet<string> | null,
): CartState {
  let changed = false;
  let ops = state.ops;
  if (referenced) {
    ops = ops.map((op) => {
      if (!op.completed && !referenced.has(op.opId)) {
        changed = true;
        return { ...op, completed: true };
      }
      return op;
    });
  }
  const completed = ops.filter((op) => op.completed);
  if (completed.length > MAX_COMPLETED_OPERATIONS) {
    const keep = new Set(
      [...completed]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, MAX_COMPLETED_OPERATIONS)
        .map((op) => op.opId),
    );
    ops = ops.filter((op) => !op.completed || keep.has(op.opId));
    changed = true;
  }
  return changed ? { ...state, ops } : state;
}
