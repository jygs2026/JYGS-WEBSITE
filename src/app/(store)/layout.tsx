import type { ReactNode } from "react";

import { AnnouncementBar } from "@/components/store/layout/announcement-bar";
import { DemoNotice } from "@/components/store/layout/demo-notice";
import { SiteFooter } from "@/components/store/layout/site-footer";
import { SiteHeader } from "@/components/store/layout/site-header";
import { getStoreSettings, isHomepageSectionVisible } from "@/services/content";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [settings, showAnnouncement] = await Promise.all([
    getStoreSettings(),
    isHomepageSectionVisible("announcement"),
  ]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-paper focus:px-4 focus:py-2 focus:text-sm focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <DemoNotice />
      {showAnnouncement && settings.announcementText ? (
        <AnnouncementBar text={settings.announcementText} />
      ) : null}
      <SiteHeader />
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}
