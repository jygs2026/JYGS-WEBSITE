import { cn } from "@/lib/utils";
import type { ProductWithDetails } from "@/types";

import { ProductCard } from "./product-card";

interface ProductGridProps {
  products: ProductWithDetails[];
  /** Optional product id → colourway id, so filtered listings show the matching colour. */
  displayColourIds?: Record<string, string | null>;
  className?: string;
}

export function ProductGrid({ products, displayColourIds, className }: ProductGridProps) {
  return (
    <ul className={cn("grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-5 lg:grid-cols-4", className)}>
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} colourId={displayColourIds?.[product.id]} />
        </li>
      ))}
    </ul>
  );
}
