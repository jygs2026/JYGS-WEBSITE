import { ArrowRight } from "lucide-react";
import Image from "next/image";

import { CtaLink } from "@/components/store/cta-link";
import { PlaceholderLabel } from "@/components/store/placeholder-label";
import type { Banner } from "@/types";

/**
 * Full-bleed campaign hero. Shows one image on mobile and, when a secondary image is set,
 * a split two-image composition from tablet up.
 */
export function Hero({ banner }: { banner: Banner }) {
  const hasSecondary = Boolean(banner.secondaryImageUrl);

  return (
    <section aria-labelledby="hero-heading" className="relative isolate overflow-hidden bg-ink">
      <div
        className={
          hasSecondary
            ? "grid h-[min(80svh,880px)] min-h-120 md:grid-cols-2"
            : "relative h-[min(80svh,880px)] min-h-120"
        }
      >
        <div className="relative h-full">
          <Image
            src={banner.imageUrl}
            alt={banner.imageAlt}
            fill
            preload
            sizes={hasSecondary ? "(min-width: 768px) 50vw, 100vw" : "100vw"}
            className="object-cover object-[50%_25%]"
          />
        </div>
        {banner.secondaryImageUrl ? (
          <div className="relative hidden h-full md:block">
            <Image
              src={banner.secondaryImageUrl}
              alt={banner.secondaryImageAlt ?? ""}
              fill
              loading="eager"
              sizes="50vw"
              className="object-cover object-[50%_25%]"
            />
          </div>
        ) : null}
      </div>

      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-black/0"
      />
      <PlaceholderLabel className="top-4 right-4">
        {hasSecondary ? "Placeholder photos" : "Placeholder photo"}
      </PlaceholderLabel>

      <div className="absolute inset-x-0 bottom-0 text-paper">
        <div className="container-site pb-10 sm:pb-14 lg:pb-20">
          {banner.eyebrow ? (
            <p className="mb-4 text-[11px] font-semibold tracking-label text-paper/80 uppercase">
              {banner.eyebrow}
            </p>
          ) : null}
          <h1
            id="hero-heading"
            className="max-w-4xl text-[clamp(2.75rem,10vw,7.5rem)] leading-[0.88] font-black tracking-[-0.02em] uppercase"
          >
            {banner.headline}
          </h1>
          {banner.subheadline ? (
            <p className="mt-5 max-w-md text-sm text-paper/80 sm:text-base">{banner.subheadline}</p>
          ) : null}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {banner.ctaLabel && banner.ctaHref ? (
              <CtaLink href={banner.ctaHref} variant="light" className="w-full sm:w-auto">
                {banner.ctaLabel}
                <ArrowRight aria-hidden />
              </CtaLink>
            ) : null}
            <CtaLink href="#new-arrivals" variant="outlineLight" className="w-full sm:w-auto">
              New Arrivals
            </CtaLink>
          </div>
        </div>
      </div>
    </section>
  );
}
