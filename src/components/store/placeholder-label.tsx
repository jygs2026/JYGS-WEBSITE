import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Small on-image label marking a stock photo as a temporary placeholder.
 * Rendered only while `demoMode` is on. Position it with `className` (e.g. "top-3 right-3").
 */
export function PlaceholderLabel({
  className,
  children = "Placeholder photo",
}: {
  className?: string;
  children?: string;
}) {
  if (!siteConfig.demoMode) return null;
  return (
    <span
      className={cn(
        "pointer-events-none absolute z-10 bg-paper/85 px-2 py-1 text-[9px] leading-none font-semibold tracking-label text-ink uppercase backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}
