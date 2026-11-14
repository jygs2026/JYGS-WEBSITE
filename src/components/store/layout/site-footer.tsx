import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { footerNav, siteConfig } from "@/config/site";
import type { StoreSettings } from "@/types";

export function SiteFooter({ settings }: { settings: StoreSettings }) {
  const contactLines = [settings.contactEmail, settings.contactPhone, settings.address].filter(
    (line): line is string => Boolean(line),
  );

  return (
    <footer className="bg-ink text-paper">
      <div className="container-site py-14 md:py-20">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <Wordmark withSubline className="text-2xl" />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-paper/60">
              {siteConfig.description}
            </p>
            <div className="mt-6 text-sm text-paper/60">
              {contactLines.length > 0 ? (
                <address className="space-y-1 not-italic">
                  {contactLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </address>
              ) : (
                <p className="max-w-sm text-xs text-paper/40">
                  Contact details, social links and store policies will be published once confirmed
                  by JYGS.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
            {footerNav.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <h2 className="text-[11px] font-semibold tracking-label text-paper/50 uppercase">
                  {group.title}
                </h2>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-paper/80 transition-colors hover:text-paper"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-paper/10 pt-6 text-xs text-paper/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {siteConfig.copyrightYear} {siteConfig.name}. All rights reserved.
          </p>
          {siteConfig.demoMode ? (
            <p>Demo preview — products, prices and images are placeholders.</p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
