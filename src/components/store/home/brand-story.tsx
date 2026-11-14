import Image from "next/image";

import { CtaLink } from "@/components/store/cta-link";
import { PlaceholderLabel } from "@/components/store/placeholder-label";
import type { BrandStory as BrandStoryContent } from "@/types";

export function BrandStory({ story }: { story: BrandStoryContent }) {
  return (
    <section aria-labelledby="brand-story-heading" className="bg-ink text-paper">
      <div className="container-site grid items-center gap-12 py-16 md:grid-cols-12 md:gap-10 md:py-28">
        <div className="md:col-span-7">
          <p className="mb-4 text-[11px] font-semibold tracking-label text-paper/60 uppercase">
            {story.eyebrow}
          </p>
          <h2
            id="brand-story-heading"
            className="text-3xl leading-[0.95] font-black tracking-tight uppercase md:text-5xl"
          >
            {story.headline}
          </h2>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-paper/70 md:text-base">
            {story.body}
          </p>

          <ol className="mt-12 grid gap-8 border-t border-paper/15 pt-10 sm:grid-cols-3">
            {story.pillars.map((pillar, i) => (
              <li key={pillar.title}>
                <span aria-hidden className="text-xs font-semibold text-paper/40 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-sm font-bold tracking-label uppercase">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper/60">{pillar.body}</p>
              </li>
            ))}
          </ol>

          <CtaLink href="/about" variant="outlineLight" className="mt-12">
            About JYGS
          </CtaLink>
        </div>

        <div className="relative aspect-4/5 overflow-hidden bg-graphite md:col-span-5">
          <Image
            src={story.imageUrl}
            alt={story.imageAlt}
            fill
            sizes="(min-width: 768px) 40vw, 100vw"
            className="object-cover"
          />
          <PlaceholderLabel className="top-3 left-3" />
        </div>
      </div>
    </section>
  );
}
