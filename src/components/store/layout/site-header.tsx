import { Search, User, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { mainNav } from "@/config/site";
import { cn } from "@/lib/utils";

import { HeaderBagLink, HeaderWishlistLink } from "./header-counts";
import { MobileNav } from "./mobile-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85">
      <div className="container-site grid h-14 grid-cols-[1fr_auto_1fr] items-center lg:h-16">
        <div className="flex items-center">
          <MobileNav className="-ml-2 xl:hidden" />
          <nav aria-label="Main" className="hidden xl:block">
            <ul className="flex items-center gap-7">
              {mainNav.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="relative py-2 text-[11px] font-semibold tracking-label uppercase after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform hover:after:scale-x-100 focus-visible:after:scale-x-100"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <Link href="/" aria-label="JYGS Clothing — home" className="px-2">
          <Wordmark className="text-base lg:text-lg" />
        </Link>

        <div className="-mr-2 flex items-center justify-end gap-0.5">
          <HeaderIconLink href="/search" label="Search" icon={Search} />
          <HeaderIconLink
            href="/account"
            label="Account"
            icon={User}
            className="hidden sm:inline-flex"
          />
          <HeaderWishlistLink className="hidden sm:inline-flex" />
          <HeaderBagLink />
        </div>
      </div>
    </header>
  );
}

interface HeaderIconLinkProps {
  href: string;
  label: string;
  icon: LucideIcon;
  className?: string;
}

function HeaderIconLink({ href, label, icon: Icon, className }: HeaderIconLinkProps) {
  return (
    <Button
      asChild
      variant="ghost"
      size="icon-lg"
      className={cn("rounded-full [&_svg:not([class*='size-'])]:size-5", className)}
    >
      <Link href={href} aria-label={label}>
        <Icon strokeWidth={1.6} aria-hidden />
      </Link>
    </Button>
  );
}
