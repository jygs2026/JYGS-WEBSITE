import type { Metadata } from "next";

import { ComingSoon } from "@/components/store/coming-soon";

export const metadata: Metadata = { title: "About JYGS" };

export default function AboutPage() {
  return (
    <ComingSoon title="About JYGS" description="Our brand story page arrives in the next build." />
  );
}
