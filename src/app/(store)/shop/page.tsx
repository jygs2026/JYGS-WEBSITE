import type { Metadata } from "next";

import { ComingSoon } from "@/components/store/coming-soon";

export const metadata: Metadata = { title: "Shop All" };

export default function ShopPage() {
  return (
    <ComingSoon
      title="Shop All"
      description="The full catalogue with filters for category, size, colour and price — plus sorting — arrives in the next build."
    />
  );
}
