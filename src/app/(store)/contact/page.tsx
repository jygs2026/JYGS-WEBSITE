import type { Metadata } from "next";

import { ComingSoon } from "@/components/store/coming-soon";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <ComingSoon
      title="Contact Us"
      description="Contact details and support information will be published once confirmed by JYGS."
    />
  );
}
