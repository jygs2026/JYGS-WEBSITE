"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types";

const VIEW_LABEL = { front: "Front", back: "Back" } as const;

/**
 * Product image gallery: swipeable scroll-snap track (touch) with labelled thumbnails and
 * previous/next buttons (pointer + keyboard). Remount it (via `key`) when the colourway changes.
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: ProductImage[];
  productName: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const labelFor = (image: ProductImage, i: number) =>
    image.view ? VIEW_LABEL[image.view] : `Image ${i + 1}`;

  function goTo(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.max(0, Math.min(images.length - 1, index));
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
    setActive(next);
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index !== active) setActive(index);
  }

  return (
    <section aria-label={`${productName} images`} className="lg:flex lg:flex-row-reverse lg:gap-4">
      <div className="relative flex-1">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, i) => (
            <div
              key={image.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${images.length}: ${labelFor(image, i)}`}
              className="relative aspect-3/4 w-full shrink-0 snap-start bg-offwhite"
            >
              <Image
                src={image.url}
                alt={image.alt}
                fill
                preload={i === 0}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
              aria-label="Previous image"
              className="absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 shadow-sm transition-opacity disabled:opacity-0 md:flex"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              disabled={active === images.length - 1}
              aria-label="Next image"
              className="absolute top-1/2 right-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 shadow-sm transition-opacity disabled:opacity-0 md:flex"
            >
              <ChevronRight aria-hidden className="size-5" />
            </button>
            {/* Mobile position indicator */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden"
            >
              {images.map((image, i) => (
                <span
                  key={image.id}
                  className={cn("h-1 w-6 bg-ink/20", i === active && "bg-ink")}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="mt-3 flex gap-2 lg:mt-0 lg:w-20 lg:flex-col">
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show ${labelFor(image, i).toLowerCase()} view`}
              aria-current={i === active ? "true" : undefined}
              className={cn(
                "group/thumb flex w-16 flex-col items-center gap-1 text-[10px] font-semibold tracking-label text-muted-foreground uppercase lg:w-full",
                i === active && "text-foreground",
              )}
            >
              <span
                className={cn(
                  "relative block aspect-3/4 w-full border bg-offwhite transition-colors",
                  i === active
                    ? "border-ink"
                    : "border-transparent group-hover/thumb:border-ink/30",
                )}
              >
                <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
              </span>
              {labelFor(image, i)}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
