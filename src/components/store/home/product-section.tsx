import { ProductGrid } from "@/components/store/product/product-grid";
import { SectionHeading } from "@/components/store/section-heading";
import { cn } from "@/lib/utils";
import type { ProductWithDetails } from "@/types";

interface ProductSectionProps {
  /** Anchor id, e.g. "new-arrivals" — allows in-page links like /#new-arrivals. */
  id: string;
  title: string;
  eyebrow?: string;
  description?: string;
  products: ProductWithDetails[];
  viewAllHref?: string;
  className?: string;
}

/** A titled product row used for New Arrivals, Best Sellers and similar collections. */
export function ProductSection({
  id,
  title,
  eyebrow,
  description,
  products,
  viewAllHref,
  className,
}: ProductSectionProps) {
  if (products.length === 0) return null;

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn("scroll-mt-20 py-16 md:py-24", className)}
    >
      <div className="container-site">
        <SectionHeading
          id={`${id}-heading`}
          eyebrow={eyebrow}
          title={title}
          description={description}
          action={viewAllHref ? { label: "View all", href: viewAllHref } : undefined}
        />
        <ProductGrid products={products} />
      </div>
    </section>
  );
}
