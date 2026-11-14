import { Wordmark } from "@/components/brand/wordmark";
import { siteConfig } from "@/config/site";

/**
 * M0 placeholder. The premium homepage is built in M1 — this page only confirms that
 * fonts, design tokens and the wordmark render correctly.
 */
export default function HomePage() {
  return (
    <main className="container-site flex flex-1 flex-col items-center justify-center gap-6 bg-offwhite py-24 text-center">
      <Wordmark withSubline className="text-4xl sm:text-5xl" />
      <p className="text-xs font-medium tracking-label text-muted-foreground uppercase">
        {siteConfig.tagline}
      </p>
      <p className="max-w-sm text-sm text-graphite">
        Project setup complete. The storefront is under construction.
      </p>
    </main>
  );
}
