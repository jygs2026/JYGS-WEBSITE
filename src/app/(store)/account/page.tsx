import type { Metadata } from "next";

import { ComingSoon } from "@/components/store/coming-soon";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <ComingSoon
      title="Your Account"
      description="Customer registration, sign-in and profile are planned for a later milestone."
      milestone="Milestone 6"
    />
  );
}
