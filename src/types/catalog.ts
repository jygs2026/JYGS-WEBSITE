/**
 * Domain models for the JYGS catalogue.
 *
 * These mirror the planned Supabase schema (brief §8, Table 4) so that mock data (M1–M3)
 * and live database data (M5+) share one contract. Money is integer paise (INR).
 * IDs are UUID strings; timestamps are ISO-8601 strings.
 */

export type UUID = string;
export type ISODateString = string;

export type ProductStatus = "draft" | "published" | "archived";

export interface Timestamps {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Category extends Timestamps {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isVisible: boolean;
  sortOrder: number;
}

/** JYGS size run. Only these five sizes are offered (no XXL). */
export type SizeLabel = "XS" | "S" | "M" | "L" | "XL";

/** JYGS makes oversized and boxy T-shirts only. */
export type ProductFit = "Oversized" | "Boxy";

export interface Size {
  id: UUID;
  label: SizeLabel;
  sortOrder: number;
}

export interface Colour {
  id: UUID;
  name: string;
  /** URL-safe identifier used in filters, e.g. "pine-green". */
  slug: string;
  /** CSS colour used for the swatch, e.g. "#111111". */
  hex: string;
  sortOrder: number;
}

export type ProductImageView = "front" | "back";

export interface ProductImage {
  id: UUID;
  productId: UUID;
  /** Colourway this image shows; null when the image applies to every colour. */
  colourId: UUID | null;
  /** Which side of the garment is shown, when known. */
  view: ProductImageView | null;
  /** Public URL (placeholder) or Supabase Storage path (M5+). */
  url: string;
  alt: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface Inventory {
  variantId: UUID;
  /** Never negative — enforced by a database check constraint. */
  quantity: number;
  lowStockThreshold: number;
  updatedAt: ISODateString;
}

export interface ProductVariant extends Timestamps {
  id: UUID;
  productId: UUID;
  sizeId: UUID;
  colourId: UUID;
  sku: string;
  /** Overrides the product price when set (paise). */
  priceOverride: number | null;
  isActive: boolean;
}

export interface Product extends Timestamps {
  id: UUID;
  name: string;
  /** Unique, URL-safe identifier used by /product/[slug]. */
  slug: string;
  description: string;
  categoryId: UUID;
  /** Price in paise. */
  price: number;
  /** Optional strike-through price in paise; must be greater than `price`. */
  compareAtPrice: number | null;
  status: ProductStatus;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isFeatured: boolean;
  /** Always "100% Compact Cotton" for JYGS tees. */
  fabric: string;
  fit: ProductFit;
  /** Fabric weight in grams per square metre — 240 to 260 for JYGS tees. */
  gsm: number;
}

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

/** A variant joined with its size, colour and inventory — what the storefront renders. */
export interface VariantWithStock extends ProductVariant {
  size: Size;
  colour: Colour;
  inventory: Inventory;
}

/** A product with everything a listing card or detail page needs. */
export interface ProductWithDetails extends Product {
  category: Category;
  images: ProductImage[];
  variants: VariantWithStock[];
}
