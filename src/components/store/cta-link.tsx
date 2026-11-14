import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const ctaLinkVariants = cva(
  "inline-flex h-12 items-center justify-center gap-2 px-7 text-xs font-bold tracking-label uppercase transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        dark: "bg-ink text-paper hover:bg-ink/85",
        light: "bg-paper text-ink hover:bg-offwhite",
        outlineDark: "border border-ink text-ink hover:bg-ink hover:text-paper",
        outlineLight:
          "border border-paper/70 text-paper hover:bg-paper hover:text-ink focus-visible:ring-paper focus-visible:ring-offset-ink",
      },
    },
    defaultVariants: { variant: "dark" },
  },
);

type CtaLinkProps = ComponentProps<typeof Link> & VariantProps<typeof ctaLinkVariants>;

/** Primary call-to-action link used across storefront sections. */
export function CtaLink({ className, variant, ...props }: CtaLinkProps) {
  return <Link className={cn(ctaLinkVariants({ variant }), className)} {...props} />;
}
