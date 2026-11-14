import { DemoNotice } from "@/components/store/layout/demo-notice";
import { SiteFooter } from "@/components/store/layout/site-footer";
import { SiteHeader } from "@/components/store/layout/site-header";
import { NotFoundContent } from "@/components/store/not-found-content";
import { getStoreSettings } from "@/services/content";

/**
 * Global 404 — used for unmatched URLs and for unknown slugs rejected by `src/proxy.ts`.
 * Renders the store chrome so visitors can keep browsing.
 */
export default async function NotFound() {
  const settings = await getStoreSettings();

  return (
    <>
      <DemoNotice />
      <SiteHeader />
      <main id="main-content" className="flex flex-1 flex-col">
        <NotFoundContent />
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}
