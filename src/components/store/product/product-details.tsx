import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { FIT_NOTES, PRINT_DETAILS, PRODUCT_FABRIC } from "@/config/product-info";
import { siteConfig } from "@/config/site";
import type { ProductWithDetails } from "@/types";

/** Product information sections (native disclosure widgets — accessible without JavaScript). */
export function ProductDetails({ product }: { product: ProductWithDetails }) {
  return (
    <div className="mt-10 divide-y divide-border border-y border-border">
      <DetailSection title="Description" defaultOpen>
        <p>{product.description}</p>
      </DetailSection>
      <DetailSection title="Fabric & weight">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
          <dt className="text-muted-foreground">Fabric</dt>
          <dd>{PRODUCT_FABRIC}</dd>
          <dt className="text-muted-foreground">Weight</dt>
          <dd>{product.gsm} GSM</dd>
        </dl>
      </DetailSection>
      <DetailSection title="Fit">
        <p>
          <strong className="font-semibold">{product.fit} fit.</strong> {FIT_NOTES[product.fit]}
        </p>
        <p className="mt-2 text-muted-foreground">
          Exact measurements will be added to the size guide once confirmed by JYGS.
        </p>
      </DetailSection>
      <DetailSection title="Print">
        <ul className="space-y-1">
          <li>Front: {PRINT_DETAILS.front}</li>
          <li>Back: {PRINT_DETAILS.back}</li>
        </ul>
        {siteConfig.demoMode ? (
          <p className="mt-2 text-muted-foreground">
            Artwork shown is placeholder — not a final JYGS design.
          </p>
        ) : null}
      </DetailSection>
      <DetailSection title="Care">
        <p className="text-muted-foreground">Care instructions will be confirmed by JYGS.</p>
      </DetailSection>
    </div>
  );
}

function DetailSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-xs font-semibold tracking-label uppercase [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-5 text-sm leading-relaxed">{children}</div>
    </details>
  );
}
