"use client";

import { Ruler } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FIT_NOTES } from "@/config/product-info";
import type { ProductFit } from "@/types";

/**
 * Size guide panel. Real JYGS measurements have not been supplied yet, so no figures are shown —
 * only a "coming soon" notice and the qualitative fit description.
 */
export function SizeGuide({ fit }: { fit: string }) {
  const note = FIT_NOTES[fit as ProductFit];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-4 hover:no-underline"
        >
          <Ruler aria-hidden className="size-3.5" />
          Size guide
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[90%] gap-0 rounded-none p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="text-sm font-semibold tracking-label uppercase">
            Size guide
          </SheetTitle>
          <SheetDescription className="sr-only">JYGS size guide</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-6 py-8">
          <div className="border border-dashed border-ink/25 bg-offwhite px-5 py-8 text-center">
            <p className="text-lg font-black tracking-tight uppercase">Size Guide Coming Soon</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
              Exact JYGS measurements for our Oversized and Boxy fits will be published here once
              confirmed.
            </p>
          </div>
          {note ? (
            <div>
              <h3 className="text-xs font-semibold tracking-label uppercase">
                About the {fit} fit
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{note}</p>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">Available sizes: XS, S, M, L and XL.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
