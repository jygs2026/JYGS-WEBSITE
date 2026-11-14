"use client";

import { ChevronDown } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { toggleValue, type FacetOptions } from "./facets";
import { useListing } from "./listing-context";

/** Filter controls (checkbox groups). Rendered in the desktop sidebar and the mobile drawer. */
export function FilterPanel({ facets, className }: { facets: FacetOptions; className?: string }) {
  const { filters, apply } = useListing();
  const id = useId();

  return (
    <div className={cn("divide-y divide-border", className)}>
      {facets.categories.length > 0 ? (
        <FilterGroup title="Category" count={filters.categories.length}>
          {facets.categories.map((o) => (
            <CheckOption
              key={o.value}
              id={`${id}-cat-${o.value}`}
              label={o.label}
              checked={filters.categories.includes(o.value)}
              onChange={() =>
                apply({ ...filters, categories: toggleValue(filters.categories, o.value) })
              }
            />
          ))}
        </FilterGroup>
      ) : null}

      <FilterGroup title="Fit" count={filters.fits.length}>
        {facets.fits.map((o) => (
          <CheckOption
            key={o.value}
            id={`${id}-fit-${o.value}`}
            label={o.label}
            checked={filters.fits.includes(o.value)}
            onChange={() => apply({ ...filters, fits: toggleValue(filters.fits, o.value) })}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Colour" count={filters.colours.length}>
        {facets.colours.map((o) => (
          <CheckOption
            key={o.value}
            id={`${id}-colour-${o.value}`}
            label={o.label}
            checked={filters.colours.includes(o.value)}
            onChange={() => apply({ ...filters, colours: toggleValue(filters.colours, o.value) })}
            swatch={o.hex}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Size" count={filters.sizes.length}>
        <div className="grid grid-cols-5 gap-1.5">
          {facets.sizes.map((o) => {
            const checked = filters.sizes.includes(o.value);
            return (
              <label key={o.value} className="relative">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={checked}
                  onChange={() => apply({ ...filters, sizes: toggleValue(filters.sizes, o.value) })}
                />
                <span className="flex h-10 cursor-pointer items-center justify-center border border-input text-xs font-semibold transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 hover:border-ink">
                  {o.label}
                </span>
              </label>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Weight" count={filters.gsm.length}>
        {facets.gsm.map((o) => (
          <CheckOption
            key={o.value}
            id={`${id}-gsm-${o.value}`}
            label={o.label}
            checked={filters.gsm.includes(o.value)}
            onChange={() => apply({ ...filters, gsm: toggleValue(filters.gsm, o.value) })}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Price" count={filters.prices.length}>
        {facets.prices.map((o) => (
          <CheckOption
            key={o.value}
            id={`${id}-price-${o.value}`}
            label={o.label}
            checked={filters.prices.includes(o.value)}
            onChange={() => apply({ ...filters, prices: toggleValue(filters.prices, o.value) })}
          />
        ))}
        <p className="pt-1 text-[11px] text-muted-foreground">
          Prices shown are demo placeholders.
        </p>
      </FilterGroup>

      <FilterGroup title="Availability" count={filters.inStock ? 1 : 0}>
        <CheckOption
          id={`${id}-stock`}
          label="In stock only"
          checked={filters.inStock}
          onChange={() => apply({ ...filters, inStock: !filters.inStock })}
        />
      </FilterGroup>
    </div>
  );
}

function FilterGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <details open className="group py-4 first:pt-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold tracking-label uppercase [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          {count > 0 ? <span className="ml-1.5 text-muted-foreground">({count})</span> : null}
        </span>
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <fieldset className="mt-3 space-y-2.5">
        <legend className="sr-only">{title}</legend>
        {children}
      </fieldset>
    </details>
  );
}

function CheckOption({
  id,
  label,
  checked,
  disabled,
  onChange,
  swatch,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  swatch?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="size-4 shrink-0 cursor-pointer accent-ink"
      />
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm">
        {swatch ? (
          <span
            aria-hidden
            className="size-4 rounded-full border border-ink/20"
            style={{ backgroundColor: swatch }}
          />
        ) : null}
        {label}
      </label>
    </div>
  );
}
