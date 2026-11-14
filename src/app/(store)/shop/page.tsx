import type { Metadata } from "next";
import { Suspense } from "react";

import {
  ListingHeader,
  ListingSkeleton,
  ProductListingResults,
} from "@/components/store/listing/product-listing";

export const metadata: Metadata = {
  title: "Shop All T-Shirts",
  description:
    "Shop premium oversized and boxy JYGS T-shirts in 100% compact cotton, 240–260 GSM — minimal front logo, strong back graphic.",
  // Filtered/searched variants (?colour=…, ?q=…) all canonicalise to the main shop page.
  alternates: { canonical: "/shop" },
};

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <div className="container-site py-8 md:py-12">
      <ListingHeader
        title="Shop All"
        description="Premium oversized and boxy tees in 100% compact cotton, 240–260 GSM."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Shop" }]}
      />
      <Suspense fallback={<ListingSkeleton />}>
        <ProductListingResults basePath="/shop" scope={{}} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
