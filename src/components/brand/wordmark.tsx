import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  /** Shows the small "CLOTHING" line beneath the wordmark. */
  withSubline?: boolean;
}

/**
 * TEMPORARY text wordmark. Replace with the approved JYGS logo file once supplied (brief §15).
 */
export function Wordmark({ className, withSubline = false }: WordmarkProps) {
  return (
    <span
      className={cn("inline-flex flex-col items-center leading-none select-none", className)}
      aria-label="JYGS Clothing"
      role="img"
    >
      <span className="relative text-[1.5em] font-black tracking-[0.18em]">
        JYGS
        <sup className="absolute top-0 -right-[0.9em] text-[0.32em] font-medium tracking-normal">
          ®
        </sup>
      </span>
      {withSubline ? (
        <span className="mt-[0.45em] pl-[0.3em] text-[0.42em] font-medium tracking-brand">
          CLOTHING
        </span>
      ) : null}
    </span>
  );
}
