import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/store/coming-soon";
import { getPolicyTitle, policies } from "@/config/routes";

export function generateStaticParams() {
  return Object.keys(policies).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: getPolicyTitle(slug) ?? "Policy" };
}

export default async function PolicyPage({ params }: PageProps<"/policies/[slug]">) {
  const { slug } = await params;
  const title = getPolicyTitle(slug);
  if (!title) notFound();

  return (
    <ComingSoon
      title={title}
      description="This policy will be published once the wording is confirmed by JYGS."
    />
  );
}
