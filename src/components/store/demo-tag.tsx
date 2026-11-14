import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/** Small inline label marking a value (e.g. a price) as a demo placeholder. */
export function DemoTag({ className }: { className?: string }) {
  if (!siteConfig.demoMode) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border border-dashed border-graphite/50 px-1 py-px text-[9px] leading-none font-semibold tracking-label text-graphite uppercase",
        className,
      )}
      title="Demo placeholder — not a real price"
    >
      Demo price<span className="sr-only"> (placeholder, not a real price)</span>
    </span>
  );
}
