import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  ListingHeader,
  ListingSkeleton,
  ProductListingResults,
} from "@/components/store/listing/product-listing";
import { getCategoryBySlug, getVisibleCategories } from "@/services/catalog";

export async function generateStaticParams() {
  const categories = await getVisibleCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category" };
  return {
    title: category.slug === "unisex" ? "Unisex T-Shirts" : `${category.name}'s T-Shirts`,
    description:
      `${category.description ?? ""} Premium oversized and boxy JYGS tees in 100% compact cotton.`.trim(),
    alternates: { canonical: `/category/${category.slug}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <div className="container-site py-8 md:py-12">
      <ListingHeader
        title={category.name}
        description={category.description ?? undefined}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: category.name },
        ]}
      />
      <Suspense fallback={<ListingSkeleton />}>
        <ProductListingResults
          basePath={`/category/${category.slug}`}
          scope={{ category: category.slug }}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  );
}
