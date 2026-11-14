import type { ISODateString, UUID } from "./catalog";

/** Homepage hero / campaign banner, managed from the admin panel (M3+). */
export interface Banner {
  id: UUID;
  eyebrow: string | null;
  headline: string;
  subheadline: string | null;
  imageUrl: string;
  imageAlt: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  isVisible: boolean;
  sortOrder: number;
  updatedAt: ISODateString;
}

export type HomepageSectionKey =
  | "announcement"
  | "hero"
  | "shop_by_category"
  | "new_arrivals"
  | "best_sellers"
  | "featured_collection"
  | "brand_story"
  | "social_gallery"
  | "newsletter";

/** Controls whether and in what order each homepage section is shown. */
export interface HomepageSection {
  key: HomepageSectionKey;
  isVisible: boolean;
  sortOrder: number;
}

export interface SocialLink {
  platform: "instagram" | "facebook" | "youtube" | "x" | "whatsapp";
  url: string;
}

/** Storefront-wide settings (brief Table 2 → Settings). */
export interface StoreSettings {
  announcementText: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  whatsappNumber: string | null;
  address: string | null;
  socialLinks: SocialLink[];
}
