import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/store/coming-soon";
import { collections, getCollectionTitle } from "@/config/routes";

export function generateStaticParams() {
  return Object.keys(collections).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: getCollectionTitle(slug) ?? "Collection" };
}

export default async function CollectionPage({ params }: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const title = getCollectionTitle(slug);
  if (!title) notFound();

  return (
    <ComingSoon
      title={title}
      description={`The complete ${title} collection page arrives in the next build. A preview is on the homepage.`}
    />
  );
}
