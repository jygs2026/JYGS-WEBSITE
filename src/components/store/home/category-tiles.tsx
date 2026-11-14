import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { PlaceholderLabel } from "@/components/store/placeholder-label";
import { SectionHeading } from "@/components/store/section-heading";
import type { Category } from "@/types";

/** Shop by category: swipeable on mobile, three-up grid from tablet. */
export function CategoryTiles({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;

  return (
    <section
      id="shop-by-category"
      aria-labelledby="shop-by-category-heading"
      className="scroll-mt-20 py-16 md:py-24"
    >
      <div className="container-site">
        <SectionHeading
          id="shop-by-category-heading"
          eyebrow="Shop by Category"
          title="Find your fit"
          action={{ label: "Shop all", href: "/shop" }}
        />
        <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
          {categories.map((category) => (
            <li key={category.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
              <Link
                href={`/category/${category.slug}`}
                className="group relative block aspect-3/4 overflow-hidden bg-offwhite outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
              >
                {category.imageUrl ? (
                  <Image
                    src={category.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 33vw, 78vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                ) : null}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-linear-to-t from-black/65 via-black/10 to-transparent"
                />
                <PlaceholderLabel className="top-3 left-3" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-paper md:p-6">
                  <div>
                    <h3 className="text-2xl font-black tracking-tight uppercase md:text-3xl">
                      {category.name}
                    </h3>
                    {category.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-paper/80">
                        {category.description}
                      </p>
                    ) : null}
                  </div>
                  <span
                    aria-hidden
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-paper/60 transition-colors group-hover:bg-paper group-hover:text-ink"
                  >
                    <ArrowUpRight className="size-4" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
