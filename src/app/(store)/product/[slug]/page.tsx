import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getProductMetadata, ProductPageContent } from "@/components/store/product/product-page";
import { getPublishedProductBySlug, getPublishedProductSlugs } from "@/services/catalog";

/**
 * Default product page (lead colourway). Requests with a valid `?colour=` are rewritten by
 * src/proxy.ts to the prebuilt per-colour page, so the right colour is in the first response.
 */
export async function generateStaticParams() {
  const slugs = await getPublishedProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);
  return product ? getProductMetadata(product) : { title: "Product" };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  // Only published products resolve; unknown/draft slugs are also rejected by src/proxy.ts (404).
  const product = await getPublishedProductBySlug(slug);
  if (!product) notFound();

  return <ProductPageContent product={product} colourId={null} />;
}
