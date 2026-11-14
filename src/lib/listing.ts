/**
 * Product listing logic: URL parameters ⇄ filters, filtering, search and sorting.
 *
 * Pure functions with no framework dependencies, shared by the server (pages) and the client
 * (filter controls build the next URL with `toSearchParams`). Unit-tested in listing.test.ts.
 *
 * URL format (multi-value params are comma-separated):
 *   /shop?q=orbit&category=men&fit=boxy&colour=cherry,black&size=m,l&gsm=250&price=1500-1699
 *        &stock=in&sort=price-asc
 */
import { GSM_RANGE, JYGS_COLOURS, PRODUCT_FITS, SIZE_LABELS } from "@/config/product-info";
import type { ProductFit, ProductWithDetails, SizeLabel } from "@/types";

import { getProductStockStatus, isColourInStock, isSizeInStock } from "./catalog";

export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
] as const;
export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

/** Price bands in paise. Bands suit the DEMO price range and will be revisited with real prices. */
export const PRICE_BANDS = [
  { value: "under-1500", label: "Under ₹1,500", min: 0, max: 149_999 },
  { value: "1500-1699", label: "₹1,500 – ₹1,699", min: 150_000, max: 169_999 },
  { value: "1700-plus", label: "₹1,700 & above", min: 170_000, max: Number.POSITIVE_INFINITY },
] as const;
export type PriceBand = (typeof PRICE_BANDS)[number]["value"];

export type CollectionSlug = "new-arrivals" | "best-sellers";

export interface ListingFilters {
  /** Product-name search. */
  q: string;
  categories: string[];
  fits: ProductFit[];
  colours: string[];
  sizes: SizeLabel[];
  gsm: number[];
  prices: PriceBand[];
  inStock: boolean;
  sort: SortKey;
}

/** Fixed context of a listing page (not changeable from the URL). */
export interface ListingScope {
  category?: string;
  collection?: CollectionSlug;
  defaultSort?: SortKey;
}

export const MAX_QUERY_LENGTH = 60;
const MAX_VALUES = 20;

export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(raw: RawSearchParams, key: string): string {
  const value = raw[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function multiValue(raw: RawSearchParams, key: string): string[] {
  const value = raw[key];
  const parts = (Array.isArray(value) ? value : [value ?? ""])
    .flatMap((v) => v.split(","))
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(parts)].slice(0, MAX_VALUES);
}

function keepAllowed<T extends string>(values: string[], allowed: readonly T[]): T[] {
  const set = new Set<string>(allowed);
  return allowed.filter((a) => set.has(a) && values.includes(a.toLowerCase()));
}

export function normaliseQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

/**
 * Parses URL search params into safe, validated filters. Unknown or malformed values are
 * silently dropped so a hand-edited URL can never break the page.
 */
export function parseListingParams(
  raw: RawSearchParams,
  scope: ListingScope = {},
  options: { categorySlugs?: readonly string[] } = {},
): ListingFilters {
  const sortValue = firstValue(raw, "sort");
  const sort = SORT_OPTIONS.some((o) => o.value === sortValue)
    ? (sortValue as SortKey)
    : (scope.defaultSort ?? "featured");

  return {
    q: normaliseQuery(firstValue(raw, "q")),
    categories: scope.category
      ? []
      : keepAllowed(multiValue(raw, "category"), options.categorySlugs ?? []),
    fits: PRODUCT_FITS.filter((fit) => multiValue(raw, "fit").includes(fit.toLowerCase())),
    colours: keepAllowed(
      multiValue(raw, "colour"),
      JYGS_COLOURS.map((c) => c.slug),
    ),
    sizes: SIZE_LABELS.filter((size) => multiValue(raw, "size").includes(size.toLowerCase())),
    gsm: [...new Set(multiValue(raw, "gsm").map(Number))]
      .filter((n) => Number.isInteger(n) && n >= GSM_RANGE.min && n <= GSM_RANGE.max)
      .sort((a, b) => a - b),
    prices: PRICE_BANDS.map((b) => b.value).filter((v) => multiValue(raw, "price").includes(v)),
    inStock: firstValue(raw, "stock") === "in",
    sort,
  };
}

/** Builds the query string for a set of filters (defaults omitted, stable ordering). */
export function toSearchParams(filters: ListingFilters, scope: ListingScope = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (!scope.category && filters.categories.length) {
    params.set("category", filters.categories.join(","));
  }
  if (filters.fits.length) params.set("fit", filters.fits.map((f) => f.toLowerCase()).join(","));
  if (filters.colours.length) params.set("colour", filters.colours.join(","));
  if (filters.sizes.length) params.set("size", filters.sizes.map((s) => s.toLowerCase()).join(","));
  if (filters.gsm.length) params.set("gsm", filters.gsm.join(","));
  if (filters.prices.length) params.set("price", filters.prices.join(","));
  if (filters.inStock) params.set("stock", "in");
  if (filters.sort !== (scope.defaultSort ?? "featured")) params.set("sort", filters.sort);
  return params;
}

/** Filters with no refinements applied. */
export function emptyFilters(sort: SortKey = "featured"): ListingFilters {
  return {
    q: "",
    categories: [],
    fits: [],
    colours: [],
    sizes: [],
    gsm: [],
    prices: [],
    inStock: false,
    sort,
  };
}

/** Same filters with every refinement cleared (sort kept). */
export function clearRefinements(filters: ListingFilters): ListingFilters {
  return emptyFilters(filters.sort);
}

/** Number of active filter values (search and sort excluded). */
export function countActiveFilters(filters: ListingFilters): number {
  return (
    filters.categories.length +
    filters.fits.length +
    filters.colours.length +
    filters.sizes.length +
    filters.gsm.length +
    filters.prices.length +
    (filters.inStock ? 1 : 0)
  );
}

function searchTokens(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** True when every search word appears in the product name (case/accent-insensitive). */
export function matchesQuery(name: string, query: string): boolean {
  const words = searchTokens(query);
  if (words.length === 0) return true;
  const haystack = searchTokens(name).join(" ");
  return words.every((w) => haystack.includes(w));
}

function selectedColourIds(product: ProductWithDetails, colourSlugs: string[]): string[] {
  return [
    ...new Set(
      product.variants.filter((v) => colourSlugs.includes(v.colour.slug)).map((v) => v.colourId),
    ),
  ];
}

function inPriceBands(price: number, bands: PriceBand[]): boolean {
  return bands.some((value) => {
    const band = PRICE_BANDS.find((b) => b.value === value);
    return band ? price >= band.min && price <= band.max : false;
  });
}

/**
 * Filters a product list. Within a filter group values are OR-ed; across groups they are AND-ed.
 * Size and stock filters respect the selected colours (e.g. "Cherry in M, in stock").
 */
export function filterProducts(
  products: ProductWithDetails[],
  filters: ListingFilters,
  scope: ListingScope = {},
): ProductWithDetails[] {
  return products.filter((p) => {
    if (scope.category && p.category.slug !== scope.category) return false;
    if (scope.collection === "new-arrivals" && !p.isNewArrival) return false;
    if (scope.collection === "best-sellers" && !p.isBestSeller) return false;

    if (!matchesQuery(p.name, filters.q)) return false;
    if (filters.categories.length && !filters.categories.includes(p.category.slug)) return false;
    if (filters.fits.length && !filters.fits.includes(p.fit)) return false;
    if (filters.gsm.length && !filters.gsm.includes(p.gsm)) return false;
    if (filters.prices.length && !inPriceBands(p.price, filters.prices)) return false;

    const colourIds = selectedColourIds(p, filters.colours);
    if (filters.colours.length && colourIds.length === 0) return false;

    if (filters.sizes.length && !filters.sizes.some((s) => isSizeInStock(p, s, colourIds))) {
      return false;
    }

    if (filters.inStock) {
      const available = filters.colours.length
        ? colourIds.some((id) => isColourInStock(p, id))
        : getProductStockStatus(p) !== "out_of_stock";
      if (!available) return false;
    }

    return true;
  });
}

const byNewest = (a: ProductWithDetails, b: ProductWithDetails) =>
  b.createdAt.localeCompare(a.createdAt);

/** Returns a sorted copy. Ties fall back to newest first, then name, for a stable order. */
export function sortProducts(products: ProductWithDetails[], sort: SortKey): ProductWithDetails[] {
  const tie = (a: ProductWithDetails, b: ProductWithDetails) =>
    byNewest(a, b) || a.name.localeCompare(b.name);
  const compare: Record<SortKey, (a: ProductWithDetails, b: ProductWithDetails) => number> = {
    featured: (a, b) =>
      Number(b.isFeatured) - Number(a.isFeatured) ||
      Number(b.isBestSeller) - Number(a.isBestSeller) ||
      tie(a, b),
    newest: tie,
    "price-asc": (a, b) => a.price - b.price || tie(a, b),
    "price-desc": (a, b) => b.price - a.price || tie(a, b),
  };
  return [...products].sort(compare[sort]);
}

/** Filter + sort in one step. */
export function applyListing(
  products: ProductWithDetails[],
  filters: ListingFilters,
  scope: ListingScope = {},
): ProductWithDetails[] {
  return sortProducts(filterProducts(products, filters, scope), filters.sort);
}

/**
 * The colourway a product card should show for the current filters: the first selected colour
 * the product offers (preferring one in stock), or null for the product's default.
 */
export function pickDisplayColourId(
  product: ProductWithDetails,
  filters: ListingFilters,
): string | null {
  const ids = selectedColourIds(product, filters.colours);
  return ids.find((id) => isColourInStock(product, id)) ?? ids[0] ?? null;
}
