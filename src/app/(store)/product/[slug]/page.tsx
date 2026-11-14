import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/store/coming-soon";
import { siteConfig } from "@/config/site";
import { getPublishedProductBySlug, getPublishedProductSlugs } from "@/services/catalog";

export async function generateStaticParams() {
  const slugs = await getPublishedProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);
  return { title: product?.name ?? "Product" };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  // Only published products resolve; drafts and archived products return 404.
  const product = await getPublishedProductBySlug(slug);
  if (!product) notFound();

  return (
    <ComingSoon
      title={product.name}
      description={`${siteConfig.demoMode ? "Demo product — the name, price and images are placeholders. " : ""}The product page — front/back gallery, size guide, fabric details and size/colour selection from live stock — arrives in the next build.`}
    />
  );
}
