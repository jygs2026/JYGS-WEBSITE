import { CtaLink } from "@/components/store/cta-link";

interface ComingSoonProps {
  title: string;
  description: string;
  /** e.g. "Milestone 2" — shown above the title. */
  milestone?: string;
}

/**
 * Temporary placeholder for storefront pages scheduled in later milestones, so that
 * navigation never leads to a broken page.
 */
export function ComingSoon({ title, description, milestone = "Milestone 2" }: ComingSoonProps) {
  return (
    <section className="container-site flex flex-1 flex-col items-center justify-center py-24 text-center md:py-32">
      <p className="mb-4 text-[11px] font-semibold tracking-label text-muted-foreground uppercase">
        Coming in {milestone}
      </p>
      <h1 className="max-w-2xl text-3xl leading-[0.95] font-black tracking-tight uppercase md:text-5xl">
        {title}
      </h1>
      <p className="mt-5 max-w-md text-sm text-muted-foreground md:text-base">{description}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <CtaLink href="/" variant="dark">
          Back to home
        </CtaLink>
        <CtaLink href="/#new-arrivals" variant="outlineDark">
          See new arrivals
        </CtaLink>
      </div>
    </section>
  );
}
