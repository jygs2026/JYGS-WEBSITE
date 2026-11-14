import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  ListingHeader,
  ListingSkeleton,
  ProductListingResults,
} from "@/components/store/listing/product-listing";
import { collectionDetails, collections, getCollectionTitle } from "@/config/routes";
import type { CollectionSlug } from "@/lib/listing";

export function generateStaticParams() {
  return Object.keys(collections).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const title = getCollectionTitle(slug);
  if (!title) return { title: "Collection" };
  return {
    title,
    description: collectionDetails[slug as CollectionSlug].description,
    alternates: { canonical: `/collections/${slug}` },
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const title = getCollectionTitle(slug);
  if (!title) notFound();
  const collection = slug as CollectionSlug;
  const details = collectionDetails[collection];

  return (
    <div className="container-site py-8 md:py-12">
      <ListingHeader
        title={title}
        description={details.description}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: title },
        ]}
      />
      <Suspense fallback={<ListingSkeleton />}>
        <ProductListingResults
          basePath={`/collections/${collection}`}
          scope={{ collection, defaultSort: details.defaultSort }}
          searchParams={searchParams}
        />
      </Suspense>
    </div>
  );
}
