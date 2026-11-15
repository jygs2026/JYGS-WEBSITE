/**
 * Joins saved wishlist items with the CURRENT catalogue for display (M3.4). Storage holds only
 * product + colour IDs; names, prices, images and demo stock always come from the catalogue.
 *
 * A colour is NEVER substituted: when the saved colour is missing (no colour saved) or no longer
 * offered, the item is shown with that explanation and cannot be added to the bag until the
 * customer chooses a colour on the product page.
 */
import { SIZE_LABELS } from "@/config/product-info";
import { imageForColour, type CatalogIndex } from "@/lib/cart/resolve-cart";
import type {
  CartCatalogImage,
  CartCatalogProduct,
  CartCatalogVariant,
  SizeLabel,
  WishlistItem,
  WishlistState,
} from "@/types";

export type WishlistItemStatus =
  /** Colour available with at least one size in demo stock. */
  | "ok"
  /** Saved without a colour: the customer must choose one on the product page. */
  | "no_colour"
  /** The saved colour is no longer offered for this product. */
  | "colour_unavailable"
  /** The saved colour has no size in demo stock. */
  | "sold_out"
  /** The product is no longer in the catalogue. */
  | "unavailable";

export interface WishlistSizeOption {
  label: SizeLabel;
  variant: CartCatalogVariant | null;
  /** Available demo stock (0 when sold out or not offered). */
  available: number;
}

export interface ResolvedWishlistItem {
  item: WishlistItem;
  status: WishlistItemStatus;
  product: CartCatalogProduct | null;
  /** The SAVED colour, when it is still offered (never another colour). */
  colour: { id: string; name: string; slug: string; hex: string } | null;
  image: CartCatalogImage | null;
  /** Current demo price in paise (0 when the product is unavailable). */
  price: number;
  sizes: WishlistSizeOption[];
  /** The item still carries a move marker (an interrupted move to the bag). */
  pendingMove: boolean;
}

function colourOf(variant: CartCatalogVariant) {
  return {
    id: variant.colourId,
    name: variant.colourName,
    slug: variant.colourSlug,
    hex: variant.colourHex,
  };
}

export function resolveWishlistItem(item: WishlistItem, index: CatalogIndex): ResolvedWishlistItem {
  const product = index.product(item.productId);
  const pendingMove = Boolean(item.pendingMove);
  const base = { item, pendingMove, sizes: [] as WishlistSizeOption[] };

  if (!product) {
    return { ...base, status: "unavailable", product: null, colour: null, image: null, price: 0 };
  }
  // Neutral product image for items without a usable colour (no colourway implied).
  const neutralImage = imageForColour(product, null);

  if (item.colourId === null) {
    return {
      ...base,
      status: "no_colour",
      product,
      colour: null,
      image: neutralImage,
      price: product.price,
    };
  }

  const colourVariants = product.variants.filter((v) => v.colourId === item.colourId && v.isActive);
  if (colourVariants.length === 0) {
    return {
      ...base,
      status: "colour_unavailable",
      product,
      colour: null,
      image: neutralImage,
      price: product.price,
    };
  }

  const sizes: WishlistSizeOption[] = SIZE_LABELS.map((label) => {
    const variant = colourVariants.find((v) => v.size === label) ?? null;
    return { label, variant, available: variant ? Math.max(0, Math.floor(variant.available)) : 0 };
  });
  return {
    ...base,
    sizes,
    status: sizes.some((s) => s.available > 0) ? "ok" : "sold_out",
    product,
    colour: colourOf(colourVariants[0]),
    image: imageForColour(product, item.colourId),
    price: product.price,
  };
}

/**
 * Name of a saved colour even when the product no longer offers it (inactive variants keep the
 * name), or null when it is unknown.
 */
export function savedColourName(item: WishlistItem, index: CatalogIndex): string | null {
  if (!item.colourId) return null;
  const product = index.product(item.productId);
  return product?.variants.find((v) => v.colourId === item.colourId)?.colourName ?? null;
}

export function resolveWishlist(state: WishlistState, index: CatalogIndex): ResolvedWishlistItem[] {
  return state.items.map((item) => resolveWishlistItem(item, index));
}
