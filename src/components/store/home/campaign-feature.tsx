import { ArrowRight } from "lucide-react";
import Image from "next/image";

import { CtaLink } from "@/components/store/cta-link";
import type { Banner } from "@/types";

/** Featured collection / campaign story: editorial image beside copy. */
export function CampaignFeature({ banner }: { banner: Banner }) {
  return (
    <section aria-labelledby="campaign-heading" className="bg-offwhite">
      <div className="container-site grid items-center gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-24">
        <div className="relative aspect-4/5 overflow-hidden bg-stone">
          <Image
            src={banner.imageUrl}
            alt={banner.imageAlt}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="max-w-lg">
          {banner.eyebrow ? (
            <p className="mb-4 text-[11px] font-semibold tracking-label text-muted-foreground uppercase">
              {banner.eyebrow}
            </p>
          ) : null}
          <h2
            id="campaign-heading"
            className="text-3xl leading-[0.95] font-black tracking-tight uppercase md:text-5xl"
          >
            {banner.headline}
          </h2>
          {banner.subheadline ? (
            <p className="mt-6 text-sm leading-relaxed text-graphite md:text-base">
              {banner.subheadline}
            </p>
          ) : null}
          {banner.ctaLabel && banner.ctaHref ? (
            <CtaLink href={banner.ctaHref} variant="dark" className="mt-8">
              {banner.ctaLabel}
              <ArrowRight aria-hidden />
            </CtaLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}
