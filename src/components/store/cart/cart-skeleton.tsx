/** Neutral placeholder while the saved bag is read (never shows "empty" before it is known). */
export function CartSkeleton() {
  return (
    <div aria-busy="true" data-cart-loading className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <p className="sr-only" role="status">
        Loading your bag…
      </p>
      <div className="space-y-5" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="grid grid-cols-[88px_1fr] gap-4 sm:grid-cols-[120px_1fr]">
            <div className="aspect-3/4 animate-pulse bg-offwhite" />
            <div className="space-y-2 pt-1">
              <div className="h-4 w-2/3 animate-pulse bg-offwhite" />
              <div className="h-3 w-1/3 animate-pulse bg-offwhite" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-56 animate-pulse bg-offwhite" aria-hidden />
    </div>
  );
}
