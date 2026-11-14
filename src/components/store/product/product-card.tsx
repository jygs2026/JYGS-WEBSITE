import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/config/site";
import {
  getDiscountPercent,
  getHoverImage,
  getPrimaryImage,
  getProductColours,
  getProductStockStatus,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { ProductWithDetails, StockStatus } from "@/types";

import { Price } from "./price";

const CARD_IMAGE_SIZES = "(min-width: 1024px) 25vw, 50vw";

interface ProductCardProps {
  product: ProductWithDetails;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const primary = getPrimaryImage(product);
  const hover = getHoverImage(product);
  const colours = getProductColours(product);
  const stockStatus = getProductStockStatus(product);
  const soldOut = stockStatus === "out_of_stock";

  return (
    <article className={cn("group relative", className)}>
      <Link
        href={`/product/${product.slug}`}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
      >
        <div className="relative aspect-3/4 overflow-hidden bg-offwhite">
          {primary ? (
            <Image
              src={primary.url}
              alt={primary.alt}
              fill
              sizes={CARD_IMAGE_SIZES}
              className={cn(
                "object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]",
                soldOut && "opacity-60 grayscale",
              )}
            />
          ) : null}
          {hover && !soldOut ? (
            // Second view revealed on hover (pointer devices only).
            <Image
              src={hover.url}
              alt=""
              aria-hidden
              fill
              sizes={CARD_IMAGE_SIZES}
              className="hidden object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 md:block"
            />
          ) : null}
          <ProductBadges
            isNew={product.isNewArrival}
            stockStatus={stockStatus}
            discount={getDiscountPercent(product.price, product.compareAtPrice)}
          />
          {siteConfig.demoMode ? (
            <span className="absolute right-2 bottom-2 bg-ink/80 px-2 py-1 text-[9px] leading-none font-semibold tracking-label text-paper uppercase backdrop-blur-sm">
              Demo product
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          <h3 className="text-sm leading-snug font-medium">{product.name}</h3>
          <p className="text-xs text-muted-foreground">
            {product.category.name}
            {product.fit ? ` · ${product.fit} fit` : null}
            {product.gsm ? ` · ${product.gsm} GSM` : null}
          </p>
          <Price price={product.price} compareAtPrice={product.compareAtPrice} />
          {colours.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="sr-only">Available in {colours.map((c) => c.name).join(", ")}</span>
              {colours.map((colour) => (
                <span
                  key={colour.id}
                  aria-hidden
                  title={colour.name}
                  className="size-3 rounded-full border border-ink/20"
                  style={{ backgroundColor: colour.hex }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    </article>
  );
}

interface ProductBadgesProps {
  isNew: boolean;
  stockStatus: StockStatus;
  discount: number | null;
}

function ProductBadges({ isNew, stockStatus, discount }: ProductBadgesProps) {
  const badges: { label: string; tone: "dark" | "light" }[] = [];
  if (stockStatus === "out_of_stock") badges.push({ label: "Sold out", tone: "light" });
  else {
    if (isNew) badges.push({ label: "New", tone: "dark" });
    if (discount) badges.push({ label: `−${discount}%`, tone: "light" });
    if (stockStatus === "low_stock") badges.push({ label: "Low stock", tone: "light" });
  }
  if (badges.length === 0) return null;

  return (
    <ul className="absolute top-2 left-2 flex flex-col items-start gap-1">
      {badges.map((badge) => (
        <li
          key={badge.label}
          className={cn(
            "px-2 py-1 text-[10px] leading-none font-semibold tracking-label uppercase",
            badge.tone === "dark" ? "bg-ink text-paper" : "bg-paper text-ink",
          )}
        >
          {badge.label}
        </li>
      ))}
    </ul>
  );
}
