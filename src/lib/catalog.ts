import { SIZE_LABELS } from "@/config/product-info";
import type {
  Colour,
  Inventory,
  ProductImage,
  ProductWithDetails,
  SizeLabel,
  StockStatus,
  VariantWithStock,
} from "@/types";

/** Stock status of a single variant, derived from inventory data (never hardcoded). */
export function getVariantStockStatus(inventory: Inventory): StockStatus {
  if (inventory.quantity <= 0) return "out_of_stock";
  if (inventory.quantity <= inventory.lowStockThreshold) return "low_stock";
  return "in_stock";
}

function isPurchasable(variant: VariantWithStock): boolean {
  return variant.isActive && variant.inventory.quantity > 0;
}

/**
 * Overall product availability:
 * - out_of_stock when no active variant has stock
 * - low_stock when every available variant is at or below its low-stock threshold
 */
export function getProductStockStatus(product: ProductWithDetails): StockStatus {
  const available = product.variants.filter(isPurchasable);
  if (available.length === 0) return "out_of_stock";
  const allLow = available.every((v) => getVariantStockStatus(v.inventory) === "low_stock");
  return allLow ? "low_stock" : "in_stock";
}

function sortedImages(product: ProductWithDetails): ProductImage[] {
  return [...product.images].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
}

export function getPrimaryImage(product: ProductWithDetails): ProductImage | undefined {
  return sortedImages(product)[0];
}

/** Second gallery image, revealed on hover in product cards. */
export function getHoverImage(product: ProductWithDetails): ProductImage | undefined {
  return sortedImages(product)[1];
}

/** Unique colours across the product's active variants, in display order. */
export function getProductColours(product: ProductWithDetails): Colour[] {
  const byId = new Map<string, Colour>();
  for (const variant of product.variants) {
    if (variant.isActive) byId.set(variant.colour.id, variant.colour);
  }
  return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** The colourway shown by default: the primary image's colour, else the first variant's. */
export function getLeadColourId(product: ProductWithDetails): string | null {
  return getPrimaryImage(product)?.colourId ?? product.variants[0]?.colourId ?? null;
}

/**
 * Resolves a colour requested via the URL (e.g. `?colour=white`) to one of the product's own
 * colourways. Matching is case-insensitive; anything unknown, malformed or not offered by this
 * product safely falls back to the product's default (lead) colour.
 */
export function resolveColourId(
  product: ProductWithDetails,
  requested: string | string[] | null | undefined,
): string | null {
  const raw = Array.isArray(requested) ? requested[0] : requested;
  const slug = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const match = slug
    ? product.variants.find((v) => v.isActive && v.colour.slug === slug)
    : undefined;
  return match?.colourId ?? getLeadColourId(product);
}

/** The URL slug of one of the product's colourways (e.g. "pine-green"), or null. */
export function getColourSlug(product: ProductWithDetails, colourId: string | null): string | null {
  if (!colourId) return null;
  return product.variants.find((v) => v.colourId === colourId)?.colour.slug ?? null;
}

/**
 * Product page URL. With a colourway it adds `?colour=<slug>` so the product page opens on that
 * colour; without one it is the plain canonical URL (`/product/slug`).
 */
export function getProductHref(product: ProductWithDetails, colourId?: string | null): string {
  const base = `/product/${product.slug}`;
  const slug = getColourSlug(product, colourId ?? null);
  return slug ? `${base}?colour=${encodeURIComponent(slug)}` : base;
}

const VIEW_ORDER = { front: 0, back: 1 } as const;

/**
 * Images for one colourway, front first then back. Falls back to colour-agnostic images, then
 * to the product's default images, so a gallery is never empty.
 */
export function getColourImages(
  product: ProductWithDetails,
  colourId: string | null | undefined,
): ProductImage[] {
  const byView = (a: ProductImage, b: ProductImage) =>
    (a.view ? VIEW_ORDER[a.view] : 2) - (b.view ? VIEW_ORDER[b.view] : 2) ||
    a.sortOrder - b.sortOrder;
  const forColour = colourId ? product.images.filter((i) => i.colourId === colourId) : [];
  if (forColour.length > 0) return [...forColour].sort(byView);
  const shared = product.images.filter((i) => i.colourId === null);
  if (shared.length > 0) return [...shared].sort(byView);
  const lead = getLeadColourId(product);
  const leadImages = product.images.filter((i) => i.colourId === lead);
  return leadImages.length > 0 ? [...leadImages].sort(byView) : sortedImages(product);
}

/** Primary + hover images for a product card, optionally for a specific colourway. */
export function getCardImages(
  product: ProductWithDetails,
  colourId?: string | null,
): { primary: ProductImage | undefined; hover: ProductImage | undefined } {
  if (!colourId) return { primary: getPrimaryImage(product), hover: getHoverImage(product) };
  const images = getColourImages(product, colourId);
  return { primary: images[0], hover: images[1] };
}

export interface SizeOption {
  label: SizeLabel;
  /** "unavailable" = this size is not offered in the selected colour. */
  status: StockStatus | "unavailable";
  quantity: number;
}

/**
 * Availability of every JYGS size (XS–XL) for one colourway — always the full run, in order,
 * so the size selector layout never shifts. Derived from inventory data.
 */
export function getSizeOptions(product: ProductWithDetails, colourId: string | null): SizeOption[] {
  return SIZE_LABELS.map((label) => {
    const variant = product.variants.find(
      (v) => v.isActive && v.size.label === label && (colourId === null || v.colourId === colourId),
    );
    if (!variant) return { label, status: "unavailable" as const, quantity: 0 };
    return {
      label,
      status: getVariantStockStatus(variant.inventory),
      quantity: variant.inventory.quantity,
    };
  });
}

/** True when at least one size is in stock in the given colourway. */
export function isColourInStock(product: ProductWithDetails, colourId: string): boolean {
  return product.variants.some((v) => v.colourId === colourId && isPurchasable(v));
}

/** True when the product can be bought in this size (in any of the given colours, if set). */
export function isSizeInStock(
  product: ProductWithDetails,
  size: SizeLabel,
  colourIds?: readonly string[],
): boolean {
  return product.variants.some(
    (v) =>
      v.size.label === size &&
      isPurchasable(v) &&
      (!colourIds || colourIds.length === 0 || colourIds.includes(v.colourId)),
  );
}

/** Whole-number discount percentage, or null when there is no valid compare-at price. */
export function getDiscountPercent(price: number, compareAtPrice: number | null): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}
