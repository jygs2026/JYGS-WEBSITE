import { DemoTag } from "@/components/store/demo-tag";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PriceProps {
  /** Paise. */
  price: number;
  /** Paise; shown struck through only when greater than `price`. */
  compareAtPrice?: number | null;
  className?: string;
}

export function Price({ price, compareAtPrice, className }: PriceProps) {
  const showCompare = compareAtPrice != null && compareAtPrice > price;

  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", className)}>
      <span className="font-semibold">
        {showCompare ? <span className="sr-only">Sale price </span> : null}
        {formatPrice(price)}
      </span>
      {showCompare ? (
        <s className="text-xs text-muted-foreground">
          <span className="sr-only">Original price </span>
          {formatPrice(compareAtPrice)}
        </s>
      ) : null}
      <DemoTag />
    </p>
  );
}
