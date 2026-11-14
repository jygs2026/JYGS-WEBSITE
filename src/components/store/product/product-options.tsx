"use client";

import { siteConfig } from "@/config/site";
import type { SizeOption } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { Colour, SizeLabel } from "@/types";

import { SizeGuide } from "./size-guide";

export interface ColourOption extends Colour {
  inStock: boolean;
}

/** Colourway picker — an accessible radio group of swatches. */
export function ColourSwatches({
  colours,
  selectedId,
  onSelect,
}: {
  colours: ColourOption[];
  selectedId: string | null;
  onSelect: (colourId: string) => void;
}) {
  const selected = colours.find((c) => c.id === selectedId);
  return (
    <fieldset>
      <legend className="text-xs font-semibold tracking-label uppercase">
        Colour: <span className="font-normal tracking-normal normal-case">{selected?.name}</span>
      </legend>
      <div className="mt-3 flex flex-wrap gap-2.5">
        {colours.map((colour) => (
          <label key={colour.id} className="relative cursor-pointer" title={colour.name}>
            <input
              type="radio"
              name="colour"
              value={colour.slug}
              checked={colour.id === selectedId}
              onChange={() => onSelect(colour.id)}
              className="peer sr-only"
            />
            <span className="sr-only">
              {colour.name}
              {colour.inStock ? "" : " (sold out)"}
            </span>
            <span
              aria-hidden
              className={cn(
                "relative block size-9 rounded-full border border-ink/20 ring-offset-2 ring-offset-background transition-shadow peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                !colour.inStock &&
                  "after:absolute after:top-1/2 after:left-1/2 after:h-px after:w-[130%] after:-translate-x-1/2 after:-rotate-45 after:bg-ink/70",
              )}
              style={{ backgroundColor: colour.hex }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const STATUS_TEXT: Record<SizeOption["status"], string> = {
  in_stock: "",
  low_stock: " — low stock",
  out_of_stock: " — sold out",
  unavailable: " — not available in this colour",
};

/** XS–XL size picker. Sold-out and unavailable sizes are disabled, never hidden. */
export function SizeSelector({
  options,
  selected,
  onSelect,
  fit,
}: {
  options: SizeOption[];
  selected: SizeLabel | null;
  onSelect: (size: SizeLabel) => void;
  fit: string;
}) {
  const selectedOption = options.find((o) => o.label === selected);
  const allUnavailable = options.every(
    (o) => o.status === "out_of_stock" || o.status === "unavailable",
  );

  return (
    <fieldset aria-describedby="size-status" className="min-w-0">
      {/*
        Floating the legend takes it out of the fieldset-border layout, so it sits on one row
        with the Size guide link (an absolutely positioned link would drop below the legend and
        crowd the XL button). The legend stays the fieldset's first child for screen readers.
      */}
      <legend className="float-left flex min-h-6 items-center text-xs font-semibold tracking-label uppercase">
        Size:{" "}
        <span className="ml-1 font-normal tracking-normal normal-case">
          {selected ?? "Select a size"}
        </span>
      </legend>
      <div className="float-right flex min-h-6 items-center">
        <SizeGuide fit={fit} />
      </div>
      <div className="clear-both grid grid-cols-5 gap-2 pt-3">
        {options.map((option) => {
          const disabled = option.status === "out_of_stock" || option.status === "unavailable";
          return (
            <label key={option.label} className={cn("relative", !disabled && "cursor-pointer")}>
              <input
                type="radio"
                name="size"
                value={option.label}
                checked={selected === option.label}
                disabled={disabled}
                onChange={() => onSelect(option.label)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex h-12 items-center justify-center border text-sm font-semibold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                  disabled
                    ? "border-border bg-offwhite text-muted-foreground/60 line-through"
                    : "border-input peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper hover:border-ink",
                )}
              >
                {option.label}
                <span className="sr-only">{STATUS_TEXT[option.status]}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p id="size-status" role="status" className="mt-2 min-h-5 text-xs text-muted-foreground">
        {allUnavailable
          ? "Sold out in this colour."
          : selectedOption?.status === "low_stock"
            ? `Low stock in ${selectedOption.label}${siteConfig.demoMode ? " (demo stock)" : ""}.`
            : ""}
      </p>
    </fieldset>
  );
}
