"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  use,
  useCallback,
  useMemo,
  useOptimistic,
  useTransition,
  type ReactNode,
} from "react";

import { toSearchParams, type ListingFilters, type ListingScope } from "@/lib/listing";
import { cn } from "@/lib/utils";

interface ListingContextValue {
  filters: ListingFilters;
  scope: ListingScope;
  /** Navigate to the listing URL for the given filters (server re-filters the results). */
  apply: (next: ListingFilters) => void;
  isPending: boolean;
}

const ListingContext = createContext<ListingContextValue | null>(null);

export function useListing(): ListingContextValue {
  const value = use(ListingContext);
  if (!value) throw new Error("useListing must be used inside <ListingProvider>");
  return value;
}

export function ListingProvider({
  basePath,
  scope,
  filters,
  children,
}: {
  basePath: string;
  scope: ListingScope;
  filters: ListingFilters;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Controls reflect the user's choice immediately while the server re-renders the results;
  // once navigation completes, the server-provided `filters` take over again.
  const [optimisticFilters, setOptimisticFilters] = useOptimistic(filters);

  const apply = useCallback(
    (next: ListingFilters) => {
      const query = toSearchParams(next, scope).toString();
      startTransition(() => {
        setOptimisticFilters(next);
        router.push(query ? `${basePath}?${query}` : basePath, { scroll: false });
      });
    },
    [basePath, router, scope, setOptimisticFilters],
  );

  const value = useMemo(
    () => ({ filters: optimisticFilters, scope, apply, isPending }),
    [optimisticFilters, scope, apply, isPending],
  );

  return <ListingContext value={value}>{children}</ListingContext>;
}

/** Dims the results while a filter change is loading. */
export function ResultsFrame({ children }: { children: ReactNode }) {
  const { isPending } = useListing();
  return (
    <div
      aria-busy={isPending}
      className={cn("transition-opacity duration-200", isPending && "opacity-50")}
    >
      {children}
    </div>
  );
}
