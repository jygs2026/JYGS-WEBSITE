import type {
  Colour,
  Inventory,
  ProductImage,
  ProductWithDetails,
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

/** Whole-number discount percentage, or null when there is no valid compare-at price. */
export function getDiscountPercent(price: number, compareAtPrice: number | null): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}
