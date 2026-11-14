import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/store/coming-soon";
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
  return { title: category?.name ?? "Category" };
}

export default async function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <ComingSoon
      title={category.name}
      description={`The ${category.name} collection page — with filters, sorting and live stock — arrives in the next build.`}
    />
  );
}
