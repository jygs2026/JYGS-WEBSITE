import type { Metadata } from "next";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { ProductSection } from "@/components/store/home/product-section";
import { PRODUCT_FABRIC } from "@/config/product-info";
import { getRelatedProducts } from "@/services/catalog";
import type { ProductWithDetails } from "@/types";

import { ProductDetails } from "./product-details";
import { ProductView } from "./product-view";
import { UrlColourProductView } from "./url-colour-product-view";

/**
 * Product page metadata. Shared by the default page and the per-colour pages so every colourway
 * keeps the same title, description and canonical URL (`/product/<slug>`).
 */
export function getProductMetadata(product: ProductWithDetails): Metadata {
  const description = `${product.description} ${PRODUCT_FABRIC}, ${product.gsm} GSM, ${product.fit.toLowerCase()} fit.`;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      url: `/product/${product.slug}`,
      type: "website",
    },
  };
}

/**
 * Full product page body, rendered for a specific colourway. Fully static — the colour is known at
 * build time, so the correct colourway is in the very first HTML response (no fallback/flash).
 */
export async function ProductPageContent({
  product,
  colourId,
}: {
  product: ProductWithDetails;
  /** Colourway to open on; null = the product's default (lead) colour. */
  colourId: string | null;
}) {
  const related = await getRelatedProducts(product, 4);

  return (
    <>
      <div className="container-site py-6 md:py-10">
        <Breadcrumbs
          className="mb-6"
          items={[
            { label: "Home", href: "/" },
            { label: "Shop", href: "/shop" },
            { label: product.category.name, href: `/category/${product.category.slug}` },
            { label: product.name },
          ]}
        />
        {/*
          The fallback is the colour the server already knows for this page (the requested colour
          on per-colour pages, the default colour otherwise) — so it always matches the URL.
          UrlColourProductView then applies the live URL, which matters for client navigations.
        */}
        <Suspense
          fallback={
            <ProductView product={product} initialColourId={colourId}>
              <ProductDetails product={product} />
            </ProductView>
          }
        >
          <UrlColourProductView product={product}>
            <ProductDetails product={product} />
          </UrlColourProductView>
        </Suspense>
      </div>

      <ProductSection
        id="related"
        eyebrow="More from JYGS"
        title="You may also like"
        products={related}
        viewAllHref={`/category/${product.category.slug}`}
        className="border-t border-border"
      />
    </>
  );
}
