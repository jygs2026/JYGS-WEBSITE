/**
 * Storage schema for the wishlist (`jygs:wishlist`, version 1).
 */
import type { StoreSchema } from "@/lib/storage/versioned-store";
import type { PendingMove, WishlistItem, WishlistState } from "@/types";

import { emptyWishlist } from "./wishlist-model";

export const WISHLIST_STORAGE_KEY = "jygs:wishlist";
export const WISHLIST_SCHEMA_VERSION = 1;

const MAX_ID_LENGTH = 200;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= MAX_ID_LENGTH;
const isIsoDate = (v: unknown): v is string =>
  typeof v === "string" && !Number.isNaN(Date.parse(v));

function parsePendingMove(value: unknown): PendingMove | undefined {
  if (!isRecord(value)) return undefined;
  const { opId, variantId, owner, startedAt, leaseExpiresAt } = value;
  if (
    !isId(opId) ||
    !isId(variantId) ||
    !isId(owner) ||
    !isIsoDate(startedAt) ||
    !isIsoDate(leaseExpiresAt)
  ) {
    return undefined;
  }
  return { opId, variantId, owner, startedAt, leaseExpiresAt };
}

function parseItem(value: unknown): WishlistItem | null {
  if (!isRecord(value)) return null;
  const { productId, colourId, addedAt } = value;
  if (!isId(productId) || !isIsoDate(addedAt)) return null;
  if (colourId !== null && !isId(colourId)) return null;
  const item: WishlistItem = { productId, colourId, addedAt };
  const pendingMove = parsePendingMove(value.pendingMove);
  if (pendingMove) item.pendingMove = pendingMove;
  return item;
}

/**
 * Validates version-1 wishlist data. Invalid items are dropped (counted); duplicate products keep
 * the first entry. Returns null when the overall shape is unrecognised.
 */
export function validateWishlistData(
  data: unknown,
): { data: WishlistState; dropped: number } | null {
  if (!isRecord(data) || !Array.isArray(data.items)) return null;
  let dropped = 0;
  const byProduct = new Map<string, WishlistItem>();
  for (const raw of data.items) {
    const item = parseItem(raw);
    if (!item) {
      dropped++;
      continue;
    }
    if (!byProduct.has(item.productId)) byProduct.set(item.productId, item);
  }
  return { data: { items: [...byProduct.values()] }, dropped };
}

export const wishlistSchema: StoreSchema<WishlistState> = {
  key: WISHLIST_STORAGE_KEY,
  version: WISHLIST_SCHEMA_VERSION,
  empty: emptyWishlist,
  validate: validateWishlistData,
  migrations: {},
};
