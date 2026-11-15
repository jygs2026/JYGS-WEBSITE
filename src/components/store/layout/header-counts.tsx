"use client";

import { Heart, ShoppingBag, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { bagLinkLabel, formatBadgeCount, wishlistLinkLabel } from "@/lib/cart/cart-feedback";
import { cn } from "@/lib/utils";

/**
 * Small count badge over an icon. Absolutely positioned so it never changes the header layout.
 * Hidden (renders nothing) until the browser value is known and the count is above zero.
 */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      data-count-badge=""
      className={cn(
        "pointer-events-none absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] leading-none font-semibold text-paper tabular-nums",
        className,
      )}
    >
      {formatBadgeCount(count)}
    </span>
  );
}

function CountIconLink({
  href,
  label,
  count,
  icon: Icon,
  className,
}: {
  href: string;
  label: string;
  count: number;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Button
      asChild
      variant="ghost"
      size="icon-lg"
      className={cn("relative rounded-full [&_svg:not([class*='size-'])]:size-5", className)}
    >
      <Link href={href} aria-label={label}>
        <Icon strokeWidth={1.6} aria-hidden />
        <CountBadge count={count} />
      </Link>
    </Button>
  );
}

/** Header Bag link with the stored unit count (all screen sizes). */
export function HeaderBagLink({ className }: { className?: string }) {
  const cart = useCart();
  const units = cart.ready ? cart.units : 0;
  return (
    <CountIconLink
      href="/cart"
      label={bagLinkLabel(units)}
      count={units}
      icon={ShoppingBag}
      className={className}
    />
  );
}

/** Header Wishlist link with the saved item count (shown from the `sm` breakpoint, as in M1). */
export function HeaderWishlistLink({ className }: { className?: string }) {
  const wishlist = useWishlist();
  const count = wishlist.ready ? wishlist.count : 0;
  return (
    <CountIconLink
      href="/wishlist"
      label={wishlistLinkLabel(count)}
      count={count}
      icon={Heart}
      className={className}
    />
  );
}
