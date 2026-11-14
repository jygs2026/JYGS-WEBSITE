"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { PRODUCT_FABRIC } from "@/config/product-info";
import {
  getColourImages,
  getColourSlug,
  getLeadColourId,
  getProductColours,
  getSizeOptions,
  isColourInStock,
} from "@/lib/catalog";
import type { ProductWithDetails, SizeLabel } from "@/types";

import { Price } from "./price";
import { ProductGallery } from "./product-gallery";
import { ColourSwatches, SizeSelector } from "./product-options";

/**
 * Interactive part of the product page: gallery + colour/size selection.
 * Selection is local UI state only — nothing is submitted (cart/ordering arrive later).
 * `children` is server-rendered product information shown under the options.
 */
export function ProductView({
  product,
  initialColourId,
  live = false,
  children,
}: {
  product: ProductWithDetails;
  /** Colourway to open on (from `?colour=`); defaults to the lead colour. */
  initialColourId?: string | null;
  /** True once rendered from the live browser URL (after hydration) rather than the static shell. */
  live?: boolean;
  children?: ReactNode;
}) {
  const colours = useMemo(
    () =>
      getProductColours(product).map((c) => ({ ...c, inStock: isColourInStock(product, c.id) })),
    [product],
  );
  const [colourId, setColourId] = useState<string | null>(
    () => initialColourId ?? getLeadColourId(product) ?? colours[0]?.id ?? null,
  );
  const [size, setSize] = useState<SizeLabel | null>(null);

  // Follow an externally changed colour (e.g. navigating to the same product with another
  // `?colour=`) without remounting. When the change came from this component's own
  // `replaceState`, the values already match and nothing happens.
  const [appliedInitial, setAppliedInitial] = useState(initialColourId);
  if (initialColourId !== appliedInitial) {
    setAppliedInitial(initialColourId);
    if (initialColourId && initialColourId !== colourId) setColourId(initialColourId);
  }

  const images = useMemo(() => getColourImages(product, colourId), [product, colourId]);
  const sizeOptions = useMemo(() => getSizeOptions(product, colourId), [product, colourId]);

  function selectColour(nextId: string) {
    setColourId(nextId);
    // Keep the chosen size only if it is still available in the new colour.
    const next = getSizeOptions(product, nextId).find((o) => o.label === size);
    if (!next || next.status === "out_of_stock" || next.status === "unavailable") setSize(null);
    syncColourParam(nextId);
  }

  /** Keeps `?colour=` in the address bar in step with the selection (no reload, no request). */
  function syncColourParam(nextId: string) {
    const params = new URLSearchParams(window.location.search);
    const slug = getColourSlug(product, nextId);
    if (!slug || nextId === getLeadColourId(product)) params.delete("colour");
    else params.set("colour", slug);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  return (
    <div
      className="grid gap-8 lg:grid-cols-12 lg:gap-12"
      data-product-view=""
      data-ready={live ? "" : undefined}
    >
      <div className="lg:col-span-7">
        <ProductGallery key={colourId} images={images} productName={product.name} />
      </div>

      <div className="lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
        <p className="text-[11px] font-semibold tracking-label text-muted-foreground uppercase">
          {product.category.name} · {product.fit} fit
        </p>
        <h1 className="mt-2 text-2xl leading-tight font-black tracking-tight uppercase md:text-3xl">
          {product.name}
        </h1>
        <Price
          price={product.price}
          compareAtPrice={product.compareAtPrice}
          className="mt-3 text-base"
        />

        <ul aria-label="Key details" className="mt-5 flex flex-wrap gap-2">
          {[PRODUCT_FABRIC, `${product.gsm} GSM`, `${product.fit} fit`].map((spec) => (
            <li
              key={spec}
              className="border border-ink/15 px-2.5 py-1 text-[11px] font-semibold tracking-label uppercase"
            >
              {spec}
            </li>
          ))}
        </ul>

        <div className="mt-8 space-y-7">
          <ColourSwatches colours={colours} selectedId={colourId} onSelect={selectColour} />
          <SizeSelector
            options={sizeOptions}
            selected={size}
            onSelect={setSize}
            fit={product.fit}
          />
        </div>

        <Button
          disabled
          aria-describedby="ordering-note"
          className="mt-4 h-12 w-full rounded-none text-xs font-bold tracking-label uppercase"
        >
          Add to Bag – Coming Soon
        </Button>
        <p id="ordering-note" className="mt-2 text-xs text-muted-foreground">
          Online ordering isn’t available yet. No payment is taken on this site.
        </p>

        {children}
      </div>
    </div>
  );
}
