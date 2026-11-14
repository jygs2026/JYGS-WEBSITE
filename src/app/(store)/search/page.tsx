import type { Metadata } from "next";

import { ComingSoon } from "@/components/store/coming-soon";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <ComingSoon
      title="Search"
      description="Product search across the catalogue arrives in the next build."
    />
  );
}
