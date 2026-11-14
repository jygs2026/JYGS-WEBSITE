import { CtaLink } from "@/components/store/cta-link";

export function NotFoundContent() {
  return (
    <section className="container-site flex flex-1 flex-col items-center justify-center py-24 text-center md:py-32">
      <p className="mb-4 text-[11px] font-semibold tracking-label text-muted-foreground uppercase">
        Error 404
      </p>
      <h1 className="text-3xl leading-[0.95] font-black tracking-tight uppercase md:text-5xl">
        Page not found
      </h1>
      <p className="mt-5 max-w-md text-sm text-muted-foreground md:text-base">
        The page you’re looking for doesn’t exist or is no longer available.
      </p>
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
