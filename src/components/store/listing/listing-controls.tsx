"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  clearRefinements,
  countActiveFilters,
  MAX_QUERY_LENGTH,
  normaliseQuery,
  SORT_OPTIONS,
  type SortKey,
} from "@/lib/listing";

import { getActiveChips, type FacetOptions } from "./facets";
import { FilterPanel } from "./filter-panel";
import { useListing } from "./listing-context";

/** Product-name search (`?q=`). Submits on Enter or the search button. */
export function SearchBox() {
  const { filters } = useListing();
  // Remount when the URL query changes (e.g. "Clear all") so the field stays in sync.
  return <SearchField key={filters.q} />;
}

function SearchField() {
  const { filters, apply } = useListing();
  const [value, setValue] = useState(filters.q);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = normaliseQuery(value);
    if (q !== filters.q) apply({ ...filters, q });
  }

  return (
    <form role="search" onSubmit={submit} className="relative w-full sm:max-w-xs">
      <label htmlFor="product-search" className="sr-only">
        Search products by name
      </label>
      <input
        id="product-search"
        type="search"
        value={value}
        maxLength={MAX_QUERY_LENGTH}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search tees…"
        autoComplete="off"
        enterKeyHint="search"
        className="h-10 w-full border border-input bg-background pr-18 pl-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute inset-y-0 right-1 flex items-center">
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue("");
              if (filters.q) apply({ ...filters, q: "" });
            }}
            className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
        <button
          type="submit"
          aria-label="Search"
          className="flex size-8 items-center justify-center hover:text-foreground"
        >
          <Search aria-hidden className="size-4" />
        </button>
      </div>
    </form>
  );
}

export function SortSelect() {
  const { filters, apply } = useListing();
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="product-sort"
        className="shrink-0 text-xs text-muted-foreground max-sm:sr-only"
      >
        Sort by
      </label>
      <select
        id="product-sort"
        value={filters.sort}
        onChange={(e) => apply({ ...filters, sort: e.target.value as SortKey })}
        className="h-10 max-w-44 min-w-0 cursor-pointer border border-input bg-background px-2 text-sm outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Mobile/tablet filter drawer (hidden on large screens, where the sidebar is shown). */
export function FilterDrawer({
  facets,
  resultCount,
}: {
  facets: FacetOptions;
  resultCount: number;
}) {
  const { filters, apply } = useListing();
  const active = countActiveFilters(filters);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-10 rounded-none px-4 lg:hidden">
          <SlidersHorizontal aria-hidden />
          Filters{active > 0 ? ` (${active})` : ""}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[88%] gap-0 rounded-none p-0 sm:max-w-sm">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-sm font-semibold tracking-label uppercase">
            Filters
          </SheetTitle>
          <SheetDescription className="sr-only">Narrow down the product list</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <FilterPanel facets={facets} />
        </div>
        <SheetFooter className="flex-row gap-2 border-t px-5 py-4">
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-none"
            disabled={active === 0}
            onClick={() => apply({ ...clearRefinements(filters), q: filters.q })}
          >
            Clear all
          </Button>
          <SheetClose asChild>
            <Button className="h-11 flex-1 rounded-none">
              Show {resultCount} {resultCount === 1 ? "result" : "results"}
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function ActiveFilters({ facets }: { facets: FacetOptions }) {
  const { filters, apply } = useListing();
  const chips = getActiveChips(filters, facets);
  if (chips.length === 0) return null;

  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-2"
      aria-label="Active filters"
      role="group"
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => apply(chip.remove(filters))}
          aria-label={`Remove filter: ${chip.label}`}
          className="inline-flex h-8 items-center gap-1.5 border border-ink/15 bg-offwhite px-3 text-xs transition-colors hover:border-ink"
        >
          {chip.label}
          <X aria-hidden className="size-3" />
        </button>
      ))}
      {chips.length > 1 ? (
        <button
          type="button"
          onClick={() => apply(clearRefinements(filters))}
          className="h-8 px-2 text-xs font-semibold underline underline-offset-4"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}

/** Live result count, announced to screen readers when filters change. */
export function ResultCount({ count }: { count: number }) {
  return (
    <p role="status" aria-live="polite" className="text-sm whitespace-nowrap text-muted-foreground">
      {count} {count === 1 ? "product" : "products"}
    </p>
  );
}

export function EmptyResults() {
  const { filters, apply } = useListing();
  return (
    <div className="flex flex-col items-center border border-dashed border-ink/20 px-6 py-20 text-center">
      <p className="text-lg font-black tracking-tight uppercase">No tees match</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {filters.q
          ? `Nothing found for “${filters.q}” with the current filters.`
          : "Try removing a filter or two."}
      </p>
      <Button
        className="mt-6 h-11 rounded-none px-6"
        onClick={() => apply(clearRefinements(filters))}
      >
        Clear all filters
      </Button>
    </div>
  );
}
