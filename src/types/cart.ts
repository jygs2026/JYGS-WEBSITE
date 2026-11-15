/**
 * Cart & Wishlist models (M3). Stored in the browser (localStorage) for guests; a future backend
 * repository can persist the same shapes.
 *
 * Stored records deliberately contain IDs and quantities only — never prices, names, images or
 * stock. Those are always resolved from the current catalogue when displayed.
 */
import type { ISODateString, ProductFit, ProductImageView, SizeLabel, UUID } from "./catalog";

/** One cart line per product variant (variant = colour + size). */
export interface CartLine {
  variantId: UUID;
  productId: UUID;
  /** Whole number ≥ 1. Display is limited to min(10, available demo stock) — see resolve-cart. */
  quantity: number;
  addedAt: ISODateString;
}

/**
 * Journal entry for an idempotent cart operation (Wishlist → Cart move). Unfinished entries are
 * never pruned while a wishlist item still references them.
 */
export interface CartOperation {
  opId: string;
  variantId: UUID;
  completed: boolean;
  at: ISODateString;
}

export interface CartState {
  lines: CartLine[];
  ops: CartOperation[];
}

/** Marker on a wishlist item while it is being moved to the cart (cross-tab safe recovery). */
export interface PendingMove {
  opId: string;
  variantId: UUID;
  /** Tab that started the move. */
  owner: string;
  startedAt: ISODateString;
  /** Used only when cross-tab locks are unavailable: after this time the move counts as failed. */
  leaseExpiresAt: ISODateString;
}

/** One wishlist entry per product, remembering the last selected colourway. */
export interface WishlistItem {
  productId: UUID;
  colourId: UUID | null;
  addedAt: ISODateString;
  pendingMove?: PendingMove;
}

export interface WishlistState {
  items: WishlistItem[];
}

// ---------------------------------------------------------------------------------------------
// Slim, serializable catalogue snapshot used by the cart & wishlist pages (resolved client-side).
// ---------------------------------------------------------------------------------------------

export interface CartCatalogVariant {
  id: UUID;
  colourId: UUID;
  colourName: string;
  colourSlug: string;
  colourHex: string;
  size: SizeLabel;
  /** Unit price in paise (variant override or product price). DEMO data. */
  price: number;
  /** Available demo stock. */
  available: number;
  isActive: boolean;
}

export interface CartCatalogImage {
  colourId: UUID | null;
  view: ProductImageView | null;
  url: string;
  alt: string;
}

export interface CartCatalogProduct {
  id: UUID;
  slug: string;
  name: string;
  /** Paise. */
  price: number;
  compareAtPrice: number | null;
  fit: ProductFit;
  gsm: number;
  images: CartCatalogImage[];
  variants: CartCatalogVariant[];
}

export interface CartCatalog {
  products: CartCatalogProduct[];
}
