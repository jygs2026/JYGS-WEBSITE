/** Neutral placeholder while the saved wishlist is read (never shows "empty" before it is known). */
export function WishlistSkeleton() {
  return (
    <div aria-busy="true" data-wishlist-loading className="space-y-5">
      <p className="sr-only" role="status">
        Loading your wishlist…
      </p>
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden
          className="grid grid-cols-[88px_1fr] gap-4 sm:grid-cols-[120px_1fr]"
        >
          <div className="aspect-3/4 animate-pulse bg-offwhite" />
          <div className="space-y-2 pt-1">
            <div className="h-4 w-2/3 animate-pulse bg-offwhite" />
            <div className="h-3 w-1/3 animate-pulse bg-offwhite" />
          </div>
        </div>
      ))}
    </div>
  );
}
