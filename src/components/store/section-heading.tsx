import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  /** Used as the heading's id so the section can reference it with aria-labelledby. */
  id: string;
  title: string;
  eyebrow?: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}

export function SectionHeading({
  id,
  title,
  eyebrow,
  description,
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-semibold tracking-label text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2 id={id} className="text-2xl font-black tracking-tight uppercase md:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-sm text-muted-foreground md:text-base">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="group inline-flex items-center gap-2 self-start text-xs font-semibold tracking-label uppercase underline-offset-4 hover:underline md:self-auto"
        >
          {action.label}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      ) : null}
    </div>
  );
}
