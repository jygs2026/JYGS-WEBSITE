/**
 * Joins stored cart lines with the CURRENT catalogue for display. Stored data never supplies
 * prices or stock.
 *
 * Line statuses:
 *   ok          — shown as stored
 *   adjusted    — stored quantity exceeds min(10, demo stock): the reduced quantity is DISPLAYED
 *                 with an explanation; storage is NOT changed until the customer acknowledges
 *   sold_out    — variant has no demo stock: excluded from subtotal, never removed automatically
 *   unavailable — product/variant no longer in the catalogue: excluded, never substituted
 */
import type {
  CartCatalog,
  CartCatalogImage,
  CartCatalogProduct,
  CartCatalogVariant,
  CartLine,
  CartState,
} from "@/types";

import { MAX_QUANTITY_PER_LINE, type VariantAvailability, type VariantLookup } from "./cart-model";

export type ResolvedLineStatus = "ok" | "adjusted" | "sold_out" | "unavailable";

export interface QuantityAdjustment {
  from: number;
  to: number;
  /** "stock": limited by demo stock; "max": limited by the 10-per-line maximum. */
  reason: "stock" | "max";
}

export interface ResolvedCartLine {
  line: CartLine;
  status: ResolvedLineStatus;
  product: CartCatalogProduct | null;
  variant: CartCatalogVariant | null;
  /** Quantity used for totals (0 for sold_out / unavailable). */
  quantity: number;
  /** Current unit price in paise (0 when unavailable). */
  unitPrice: number;
  lineTotal: number;
  /** min(10, available demo stock). */
  limit: number;
  adjustment: QuantityAdjustment | null;
  image: CartCatalogImage | null;
}

export interface ResolvedCart {
  lines: ResolvedCartLine[];
  subtotal: number;
  /** Units counted in the subtotal. */
  units: number;
  /** Units as stored (what the header badge shows). */
  storedUnits: number;
  adjustedCount: number;
  unavailableCount: number;
}

export interface CatalogIndex {
  product(productId: string): CartCatalogProduct | null;
  variant(variantId: string): { product: CartCatalogProduct; variant: CartCatalogVariant } | null;
}

export function indexCatalog(catalog: CartCatalog): CatalogIndex {
  const products = new Map<string, CartCatalogProduct>();
  const variants = new Map<string, { product: CartCatalogProduct; variant: CartCatalogVariant }>();
  for (const product of catalog.products) {
    products.set(product.id, product);
    for (const variant of product.variants) variants.set(variant.id, { product, variant });
  }
  return {
    product: (id) => products.get(id) ?? null,
    variant: (id) => variants.get(id) ?? null,
  };
}

export function toAvailability(
  product: CartCatalogProduct,
  variant: CartCatalogVariant,
): VariantAvailability {
  return {
    variantId: variant.id,
    productId: product.id,
    available: variant.available,
    isActive: variant.isActive,
  };
}

/** Variant availability lookup backed by the catalogue (for cart model operations). */
export function createVariantLookup(index: CatalogIndex): VariantLookup {
  return (variantId) => {
    const entry = index.variant(variantId);
    return entry ? toAvailability(entry.product, entry.variant) : null;
  };
}

/** Front image for a colourway (falls back to any image of that colour, then any image). */
export function imageForColour(
  product: CartCatalogProduct,
  colourId: string | null,
): CartCatalogImage | null {
  const ofColour = product.images.filter((i) => i.colourId === colourId);
  return (
    ofColour.find((i) => i.view === "front") ??
    ofColour[0] ??
    product.images.find((i) => i.view === "front") ??
    product.images[0] ??
    null
  );
}

export function resolveLine(line: CartLine, index: CatalogIndex): ResolvedCartLine {
  const entry = index.variant(line.variantId);
  if (!entry || entry.product.id !== line.productId || !entry.variant.isActive) {
    const product = entry?.product ?? index.product(line.productId);
    return {
      line,
      status: "unavailable",
      product,
      variant: entry?.variant ?? null,
      quantity: 0,
      unitPrice: 0,
      lineTotal: 0,
      limit: 0,
      adjustment: null,
      image: product ? imageForColour(product, entry?.variant.colourId ?? null) : null,
    };
  }

  const { product, variant } = entry;
  const image = imageForColour(product, variant.colourId);
  const available = Math.max(0, Math.floor(variant.available));
  const limit = Math.min(MAX_QUANTITY_PER_LINE, available);

  if (limit === 0) {
    return {
      line,
      status: "sold_out",
      product,
      variant,
      quantity: 0,
      unitPrice: variant.price,
      lineTotal: 0,
      limit,
      adjustment: null,
      image,
    };
  }

  if (line.quantity > limit) {
    const reason: QuantityAdjustment["reason"] =
      available < MAX_QUANTITY_PER_LINE && line.quantity > available ? "stock" : "max";
    return {
      line,
      status: "adjusted",
      product,
      variant,
      quantity: limit,
      unitPrice: variant.price,
      lineTotal: limit * variant.price,
      limit,
      adjustment: { from: line.quantity, to: limit, reason },
      image,
    };
  }

  return {
    line,
    status: "ok",
    product,
    variant,
    quantity: line.quantity,
    unitPrice: variant.price,
    lineTotal: line.quantity * variant.price,
    limit,
    adjustment: null,
    image,
  };
}

export function resolveCart(state: CartState, index: CatalogIndex): ResolvedCart {
  const lines = state.lines.map((line) => resolveLine(line, index));
  return {
    lines,
    subtotal: lines.reduce((sum, l) => sum + l.lineTotal, 0),
    units: lines.reduce((sum, l) => sum + l.quantity, 0),
    storedUnits: state.lines.reduce((sum, l) => sum + l.quantity, 0),
    adjustedCount: lines.filter((l) => l.status === "adjusted").length,
    unavailableCount: lines.filter((l) => l.status === "sold_out" || l.status === "unavailable")
      .length,
  };
}
