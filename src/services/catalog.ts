/**
 * Catalogue data access.
 *
 * UI code must read catalogue data only through these functions. They currently return
 * demo mock data; in M5 their bodies switch to Supabase queries with the same signatures,
 * so pages and components do not change.
 *
 * Every public function returns only PUBLISHED products and VISIBLE categories.
 */
import { mockCategories, mockProducts } from "@/mocks/catalog";
import type { Category, ProductWithDetails } from "@/types";

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
