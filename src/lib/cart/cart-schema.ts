/**
 * Storage schema for the cart (`jygs:cart`, version 1): validation and migrations.
 * Unknown/future versions are preserved untouched by the versioned store (never overwritten).
 */
import type { StoreSchema } from "@/lib/storage/versioned-store";
import type { CartLine, CartOperation, CartState } from "@/types";

import { emptyCart } from "./cart-model";

export const CART_STORAGE_KEY = "jygs:cart";
export const CART_SCHEMA_VERSION = 1;
/** Sanity bound for stored quantities (display is limited to 10 / stock by resolve-cart). */
export const MAX_STORED_QUANTITY = 999;

const MAX_ID_LENGTH = 200;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= MAX_ID_LENGTH;
const isIsoDate = (v: unknown): v is string =>
  typeof v === "string" && !Number.isNaN(Date.parse(v));

function parseLine(value: unknown): CartLine | null {
  if (!isRecord(value)) return null;
  const { variantId, productId, quantity, addedAt } = value;
  if (!isId(variantId) || !isId(productId) || !isIsoDate(addedAt)) return null;
  if (
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_STORED_QUANTITY
  ) {
    return null;
  }
  return { variantId, productId, quantity, addedAt };
}

function parseOperation(value: unknown): CartOperation | null {
  if (!isRecord(value)) return null;
  const { opId, variantId, completed, at } = value;
  if (!isId(opId) || !isId(variantId) || typeof completed !== "boolean" || !isIsoDate(at))
    return null;
  return { opId, variantId, completed, at };
}

/**
 * Validates version-1 cart data. Invalid lines are dropped (counted); duplicate variants are merged
 * (quantities summed, earliest addedAt kept). Invalid journal entries are dropped silently.
 * Returns null when the overall shape is unrecognised.
 */
export function validateCartData(data: unknown): { data: CartState; dropped: number } | null {
  if (!isRecord(data) || !Array.isArray(data.lines)) return null;
  if (data.ops !== undefined && !Array.isArray(data.ops)) return null;

  let dropped = 0;
  const byVariant = new Map<string, CartLine>();
  for (const raw of data.lines) {
    const line = parseLine(raw);
    if (!line) {
      dropped++;
      continue;
    }
    const existing = byVariant.get(line.variantId);
    if (!existing) {
      byVariant.set(line.variantId, line);
    } else if (existing.productId !== line.productId) {
      dropped++; // conflicting duplicate — keep the first
    } else {
      byVariant.set(line.variantId, {
        ...existing,
        quantity: Math.min(MAX_STORED_QUANTITY, existing.quantity + line.quantity),
        addedAt: existing.addedAt <= line.addedAt ? existing.addedAt : line.addedAt,
      });
    }
  }

  const ops: CartOperation[] = [];
  const seenOps = new Set<string>();
  for (const raw of (data.ops as unknown[] | undefined) ?? []) {
    const op = parseOperation(raw);
    if (op && !seenOps.has(op.opId)) {
      seenOps.add(op.opId);
      ops.push(op);
    }
  }

  return { data: { lines: [...byVariant.values()], ops }, dropped };
}

export const cartSchema: StoreSchema<CartState> = {
  key: CART_STORAGE_KEY,
  version: CART_SCHEMA_VERSION,
  empty: emptyCart,
  validate: validateCartData,
  // No earlier cart version has shipped; future migrations register here (n → n + 1).
  migrations: {},
};
