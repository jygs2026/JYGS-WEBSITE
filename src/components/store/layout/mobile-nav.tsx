"use client";

import { ArrowRight, Menu } from "lucide-react";
import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { mainNav, secondaryNav } from "@/config/site";
import { useWishlist } from "@/hooks/use-wishlist";
import { formatBadgeCount, wishlistLinkLabel } from "@/lib/cart/cart-feedback";
import { cn } from "@/lib/utils";

/** Slide-in navigation drawer for mobile and tablet. */
export function MobileNav({ className }: { className?: string }) {
  const wishlist = useWishlist();
  const wishlistCount = wishlist.ready ? wishlist.count : 0;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Open menu"
          className={cn("rounded-full [&_svg:not([class*='size-'])]:size-5", className)}
        >
          <Menu strokeWidth={1.6} aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[86%] gap-0 rounded-none p-0 sm:max-w-sm">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-base">
            <Wordmark />
          </SheetTitle>
          <SheetDescription className="sr-only">Store navigation</SheetDescription>
        </SheetHeader>

        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-5 py-4">
          <ul>
            {mainNav.map((link) => (
              <li key={link.href} className="border-b border-border/60">
                <SheetClose asChild>
                  <Link
                    href={link.href}
                    className="flex items-center justify-between py-4 text-lg font-black tracking-tight uppercase"
                  >
                    {link.label}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
          <ul className="mt-8 space-y-4">
            {secondaryNav.map((link) => {
              const isWishlist = link.href === "/wishlist";
              return (
                <li key={link.href}>
                  <SheetClose asChild>
                    <Link
                      href={link.href}
                      aria-label={isWishlist ? wishlistLinkLabel(wishlistCount) : undefined}
                      className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                      {isWishlist && wishlistCount > 0 ? (
                        <span
                          aria-hidden
                          data-count-badge=""
                          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-[10px] leading-none font-semibold text-paper tabular-nums"
                        >
                          {formatBadgeCount(wishlistCount)}
                        </span>
                      ) : null}
                    </Link>
                  </SheetClose>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
