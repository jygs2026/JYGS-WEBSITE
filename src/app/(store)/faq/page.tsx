import type { Metadata } from "next";

import { ComingSoon } from "@/components/store/coming-soon";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <ComingSoon
      title="FAQ"
      description="Answers to common questions about sizing, shipping and returns arrive in the next build."
    />
  );
}
