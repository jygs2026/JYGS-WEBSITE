import type { ListingFilters, PriceBand } from "@/lib/listing";
import type { FilterFacets } from "@/services/catalog";
import type { ProductFit, SizeLabel } from "@/types";

/** Serializable filter options passed from the server to the client filter controls. */
export interface FacetOptions {
  categories: { value: string; label: string }[];
  fits: { value: ProductFit; label: string }[];
  colours: { value: string; label: string; hex: string }[];
  sizes: { value: SizeLabel; label: string }[];
  gsm: { value: number; label: string }[];
  prices: { value: PriceBand; label: string }[];
}

export function toFacetOptions(facets: FilterFacets): FacetOptions {
  return {
    categories: facets.categories.map((c) => ({ value: c.slug, label: c.name })),
    fits: facets.fits.map((fit) => ({ value: fit, label: `${fit} fit` })),
    colours: facets.colours.map((c) => ({ value: c.slug, label: c.name, hex: c.hex })),
    sizes: facets.sizes.map((s) => ({ value: s, label: s })),
    gsm: facets.gsm.map((g) => ({ value: g, label: `${g} GSM` })),
    prices: facets.prices.map((p) => ({ value: p.value, label: p.label })),
  };
}

export function toggleValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export interface ActiveChip {
  key: string;
  label: string;
  remove: (filters: ListingFilters) => ListingFilters;
}

/** Human-readable chips for every active refinement, each with its own "remove" transform. */
export function getActiveChips(filters: ListingFilters, facets: FacetOptions): ActiveChip[] {
  const labelOf = <V>(options: { value: V; label: string }[], value: V) =>
    options.find((o) => o.value === value)?.label ?? String(value);

  const chips: ActiveChip[] = [];
  if (filters.q) {
    chips.push({ key: "q", label: `Search: “${filters.q}”`, remove: (f) => ({ ...f, q: "" }) });
  }
  for (const v of filters.categories) {
    chips.push({
      key: `category-${v}`,
      label: labelOf(facets.categories, v),
      remove: (f) => ({ ...f, categories: f.categories.filter((x) => x !== v) }),
    });
  }
  for (const v of filters.fits) {
    chips.push({
      key: `fit-${v}`,
      label: `${v} fit`,
      remove: (f) => ({ ...f, fits: f.fits.filter((x) => x !== v) }),
    });
  }
  for (const v of filters.colours) {
    chips.push({
      key: `colour-${v}`,
      label: labelOf(facets.colours, v),
      remove: (f) => ({ ...f, colours: f.colours.filter((x) => x !== v) }),
    });
  }
  for (const v of filters.sizes) {
    chips.push({
      key: `size-${v}`,
      label: `Size ${v}`,
      remove: (f) => ({ ...f, sizes: f.sizes.filter((x) => x !== v) }),
    });
  }
  for (const v of filters.gsm) {
    chips.push({
      key: `gsm-${v}`,
      label: `${v} GSM`,
      remove: (f) => ({ ...f, gsm: f.gsm.filter((x) => x !== v) }),
    });
  }
  for (const v of filters.prices) {
    chips.push({
      key: `price-${v}`,
      label: labelOf(facets.prices, v),
      remove: (f) => ({ ...f, prices: f.prices.filter((x) => x !== v) }),
    });
  }
  if (filters.inStock) {
    chips.push({ key: "stock", label: "In stock only", remove: (f) => ({ ...f, inStock: false }) });
  }
  return chips;
}
