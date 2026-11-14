import Image from "next/image";

import { SectionHeading } from "@/components/store/section-heading";
import { siteConfig } from "@/config/site";
import type { SocialGallery as SocialGalleryContent } from "@/types";

/** Instagram-style image grid. Links out only once a real profile URL is configured. */
export function SocialGallery({ gallery }: { gallery: SocialGalleryContent }) {
  if (gallery.images.length === 0) return null;

  return (
    <section aria-labelledby="social-heading" className="py-16 md:py-24">
      <div className="container-site">
        <SectionHeading
          id="social-heading"
          eyebrow="Community"
          title={gallery.handle}
          description={`${
            gallery.profileUrl
              ? "Tag us in your fits to be featured."
              : "Social channels will be linked here once the JYGS accounts are confirmed."
          }${siteConfig.demoMode ? " Photos shown are temporary placeholders." : ""}`}
          action={gallery.profileUrl ? { label: "Follow us", href: gallery.profileUrl } : undefined}
        />
        <ul className="grid grid-cols-3 gap-1 md:grid-cols-6 md:gap-2">
          {gallery.images.map((image) => (
            <li key={image.id} className="relative aspect-square overflow-hidden bg-offwhite">
              <Image
                src={image.imageUrl}
                alt={image.imageAlt}
                fill
                sizes="(min-width: 768px) 16vw, 33vw"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
