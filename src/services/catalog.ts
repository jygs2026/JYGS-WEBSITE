/**
 * Catalogue data access.
 *
 * UI code must read catalogue data only through these functions. They currently return
 * demo mock data; in M5 their bodies switch to Supabase queries with the same signatures,
 * so pages and components do not change.
 *
 * Every public function returns only PUBLISHED products and VISIBLE categories.
 */
import { PRODUCT_FITS, SIZE_LABELS } from "@/config/product-info";
import {
  applyListing,
  emptyFilters,
  filterProducts,
  PRICE_BANDS,
  type ListingFilters,
  type ListingScope,
} from "@/lib/listing";
import { mockCategories, mockColours, mockProducts } from "@/mocks/catalog";
import type { Category, Colour, ProductFit, ProductWithDetails, SizeLabel } from "@/types";

function publishedProducts(): ProductWithDetails[] {
  return mockProducts.filter((p) => p.status === "published" && p.category.isVisible);
}

function newestFirst(a: ProductWithDetails, b: ProductWithDetails): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export async function getVisibleCategories(): Promise<Category[]> {
  return mockCategories.filter((c) => c.isVisible).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return mockCategories.find((c) => c.slug === slug && c.isVisible) ?? null;
}

export async function getNewArrivals(limit = 4): Promise<ProductWithDetails[]> {
  return publishedProducts()
    .filter((p) => p.isNewArrival)
    .sort(newestFirst)
    .slice(0, limit);
}

export async function getBestSellers(limit = 4): Promise<ProductWithDetails[]> {
  return publishedProducts()
    .filter((p) => p.isBestSeller)
    .sort(newestFirst)
    .slice(0, limit);
}

export async function getPublishedProductBySlug(slug: string): Promise<ProductWithDetails | null> {
  return publishedProducts().find((p) => p.slug === slug) ?? null;
}

export async function getPublishedProductSlugs(): Promise<string[]> {
  return publishedProducts().map((p) => p.slug);
}

export async function getPublishedProducts(): Promise<ProductWithDetails[]> {
  return publishedProducts();
}

/** Filtered + sorted published products for a listing page. */
export async function listProducts(
  filters: ListingFilters,
  scope: ListingScope = {},
): Promise<ProductWithDetails[]> {
  return applyListing(publishedProducts(), filters, scope);
}

export interface FilterFacets {
  categories: Pick<Category, "slug" | "name">[];
  fits: ProductFit[];
  colours: Colour[];
  sizes: SizeLabel[];
  gsm: number[];
  prices: (typeof PRICE_BANDS)[number][];
}

/**
 * Filter options for a listing scope — only values that exist in the scoped products, so a
 * filter can never offer an option that always returns nothing.
 */
export async function getFilterFacets(scope: ListingScope = {}): Promise<FilterFacets> {
  const products = filterProducts(publishedProducts(), emptyFilters(), scope);
  const colourIds = new Set(products.flatMap((p) => p.variants.map((v) => v.colourId)));
  const categories = await getVisibleCategories();

  return {
    categories: scope.category
      ? []
      : categories
          .filter((c) => products.some((p) => p.categoryId === c.id))
          .map(({ slug, name }) => ({ slug, name })),
    fits: PRODUCT_FITS.filter((fit) => products.some((p) => p.fit === fit)),
    colours: mockColours.filter((c) => colourIds.has(c.id)),
    sizes: [...SIZE_LABELS],
    gsm: [...new Set(products.map((p) => p.gsm))].sort((a, b) => a - b),
    prices: PRICE_BANDS.filter((band) =>
      products.some((p) => p.price >= band.min && p.price <= band.max),
    ),
  };
}

/** Up to `limit` other published products, same category first, then newest. */
export async function getRelatedProducts(
  product: ProductWithDetails,
  limit = 4,
): Promise<ProductWithDetails[]> {
  const others = publishedProducts()
    .filter((p) => p.id !== product.id)
    .sort(newestFirst);
  const sameCategory = others.filter((p) => p.categoryId === product.categoryId);
  const rest = others.filter((p) => p.categoryId !== product.categoryId);
  return [...sameCategory, ...rest].slice(0, limit);
}
