import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getProductMetadata, ProductPageContent } from "@/components/store/product/product-page";
import { getColourSlug, getProductColours } from "@/lib/catalog";
import { getPublishedProductBySlug, getPublishedProducts } from "@/services/catalog";

/**
 * INTERNAL per-colour product page — prebuilt for every product × colourway.
 *
 * Customers never see this URL: src/proxy.ts rewrites `/product/<slug>?colour=<colour>` here
 * (the address bar keeps the `?colour=` URL) and returns 404 for direct requests to this path.
 * Rendering the colour at build time means the requested colourway is in the very first HTML
 * response — the default colour is never shown, even briefly.
 */
export async function generateStaticParams() {
  const products = await getPublishedProducts();
  return products.flatMap((product) =>
    getProductColours(product).map((colour) => ({ slug: product.slug, colour: colour.slug })),
  );
}

async function resolve(params: PageProps<"/product/[slug]/colour/[colour]">["params"]) {
  const { slug, colour } = await params;
  const product = await getPublishedProductBySlug(slug);
  const colourId =
    product?.variants.find((v) => v.isActive && v.colour.slug === colour)?.colourId ?? null;
  return { product, colourId };
}

export async function generateMetadata({
  params,
}: PageProps<"/product/[slug]/colour/[colour]">): Promise<Metadata> {
  const { product } = await resolve(params);
  // Same metadata and canonical (/product/<slug>) as the default product page.
  return product ? getProductMetadata(product) : { title: "Product" };
}

export default async function ProductColourPage({
  params,
}: PageProps<"/product/[slug]/colour/[colour]">) {
  const { product, colourId } = await resolve(params);
  if (!product || !colourId || !getColourSlug(product, colourId)) notFound();

  return <ProductPageContent product={product} colourId={colourId} />;
}
