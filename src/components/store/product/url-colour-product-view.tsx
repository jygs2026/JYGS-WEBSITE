"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { resolveColourId } from "@/lib/catalog";
import type { ProductWithDetails } from "@/types";

import { ProductView } from "./product-view";

/**
 * Applies the browser URL's `?colour=` to the product view.
 *
 * Needed for client-side navigations (e.g. clicking a colour-filtered shop card): the router can
 * reuse the product route's cached static output, but this component reads the destination URL
 * synchronously, so the requested colour renders immediately. On direct visits, the server has
 * already rendered the same colour (see src/proxy.ts), so the result is identical.
 */
export function UrlColourProductView({
  product,
  children,
}: {
  product: ProductWithDetails;
  children?: ReactNode;
}) {
  const searchParams = useSearchParams();
  const colourId = resolveColourId(product, searchParams.get("colour"));
  return (
    <ProductView product={product} initialColourId={colourId} live>
      {children}
    </ProductView>
  );
}
