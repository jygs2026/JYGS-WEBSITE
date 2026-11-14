import { Breadcrumbs, type Crumb } from "@/components/store/breadcrumbs";
import { ProductGrid } from "@/components/store/product/product-grid";
import {
  parseListingParams,
  pickDisplayColourId,
  type ListingScope,
  type RawSearchParams,
} from "@/lib/listing";
import { getFilterFacets, getVisibleCategories, listProducts } from "@/services/catalog";

import { toFacetOptions } from "./facets";
import { FilterPanel } from "./filter-panel";
import {
  ActiveFilters,
  EmptyResults,
  FilterDrawer,
  ResultCount,
  SearchBox,
  SortSelect,
} from "./listing-controls";
import { ListingProvider, ResultsFrame } from "./listing-context";

/** Static page heading — rendered outside the Suspense boundary so it is in the static shell. */
export function ListingHeader({
  title,
  description,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  breadcrumbs: Crumb[];
}) {
  return (
    <header className="mb-8 md:mb-10">
      <Breadcrumbs items={breadcrumbs} className="mb-4" />
      <h1 className="text-3xl font-black tracking-tight uppercase md:text-5xl">{title}</h1>
      {description ? (
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p>
      ) : null}
    </header>
  );
}

/**
 * Filterable product listing. Reads the URL search params (runtime data), so it must be
 * rendered inside <Suspense>. Filtering and sorting run on the server via the services layer.
 */
export async function ProductListingResults({
  basePath,
  scope,
  searchParams,
}: {
  basePath: string;
  scope: ListingScope;
  searchParams: Promise<RawSearchParams>;
}) {
  const [raw, categories] = await Promise.all([searchParams, getVisibleCategories()]);
  const filters = parseListingParams(raw, scope, { categorySlugs: categories.map((c) => c.slug) });
  const [products, facets] = await Promise.all([
    listProducts(filters, scope),
    getFilterFacets(scope),
  ]);
  const facetOptions = toFacetOptions(facets);
  const displayColourIds = Object.fromEntries(
    products.map((p) => [p.id, pickDisplayColourId(p, filters)]),
  );

  return (
    <ListingProvider basePath={basePath} scope={scope} filters={filters}>
      <div className="mb-6 flex flex-col gap-3 border-y border-border py-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBox />
        <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end">
          <ResultCount count={products.length} />
          <div className="flex min-w-0 items-center gap-2">
            <FilterDrawer facets={facetOptions} resultCount={products.length} />
            <SortSelect />
          </div>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-10 xl:grid-cols-[240px_1fr]">
        <aside aria-label="Product filters" className="hidden lg:block">
          <FilterPanel facets={facetOptions} />
        </aside>
        <div>
          <ActiveFilters facets={facetOptions} />
          <ResultsFrame>
            {products.length > 0 ? (
              <ProductGrid
                products={products}
                displayColourIds={displayColourIds}
                className="lg:grid-cols-3"
              />
            ) : (
              <EmptyResults />
            )}
          </ResultsFrame>
        </div>
      </div>
    </ListingProvider>
  );
}

/** Loading placeholder shown while listing results stream in. */
export function ListingSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="mb-6 h-16 border-y border-border" />
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-10 xl:grid-cols-[240px_1fr]">
        <div className="hidden space-y-4 lg:block">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-24 bg-offwhite" />
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-5 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <div className="aspect-3/4 bg-offwhite" />
              <div className="mt-3 h-4 w-3/4 bg-offwhite" />
              <div className="mt-2 h-3 w-1/2 bg-offwhite" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
