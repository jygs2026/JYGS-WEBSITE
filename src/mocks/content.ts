/**
 * DEMO PLACEHOLDER HOMEPAGE CONTENT.
 * Copy and imagery are temporary; the owner will manage these from the admin panel (M3/M5).
 * All photos are temporary stock placeholders (see ./images.ts) — alt text says so explicitly.
 */
import type { Banner, BrandStory, HomepageSection, SocialGallery, StoreSettings } from "@/types";

import { stockPhoto, teeArt, type StockPhotoKey } from "./images";

const UPDATED_AT = "2026-11-01T00:00:00.000Z";

export const mockHeroBanner: Banner = {
  id: "00000000-0000-4000-8007-000000000001",
  eyebrow: "New Collection",
  headline: "Essentials Redefined",
  subheadline:
    "Premium oversized and boxy T-shirts in 240–260 GSM compact cotton. Minimal fronts, statement backs.",
  imageUrl: stockPhoto("manBlackTeeShades", 1600),
  imageAlt: "Placeholder photo: model wearing a plain black tee",
  secondaryImageUrl: stockPhoto("manWhiteTeeStudio", 1600),
  secondaryImageAlt: "Placeholder photo: model wearing a plain white tee",
  ctaLabel: "Shop Collection",
  ctaHref: "/shop",
  isVisible: true,
  sortOrder: 1,
  updatedAt: UPDATED_AT,
};

export const mockCampaignBanner: Banner = {
  id: "00000000-0000-4000-8007-000000000002",
  eyebrow: "Campaign — The Back Graphic Edit",
  headline: "Quiet on the front. Loud on the back.",
  subheadline:
    "Our signature approach: a small logo on the front, a strong graphic on the back. Oversized tees in compact cotton, made to be seen walking away.",
  imageUrl: teeArt("black", "back", "stack"),
  imageAlt: "Placeholder artwork: back of a black oversized tee with a large JYGS wordmark",
  secondaryImageUrl: null,
  secondaryImageAlt: null,
  ctaLabel: "Explore New Arrivals",
  ctaHref: "/collections/new-arrivals",
  isVisible: true,
  sortOrder: 2,
  updatedAt: UPDATED_AT,
};

export const mockBrandStory: BrandStory = {
  eyebrow: "The JYGS Standard",
  headline: "Made for everyday. Built to stand out.",
  body: "JYGS is a premium oversized T-shirt label for men and women who want their essentials to feel considered. Fewer, better tees — designed to be worn on repeat.",
  imageUrl: stockPhoto("whiteTeeHanger", 1200),
  imageAlt: "Placeholder photo: a plain white tee hanging against a concrete wall",
  pillars: [
    {
      title: "Oversized & boxy",
      body: "Dropped shoulders and wide, boxy bodies, cut to drape rather than cling.",
    },
    {
      title: "Compact cotton",
      body: "240–260 GSM compact cotton that holds its shape and softens with every wash.",
    },
    {
      title: "Back graphics",
      body: "A minimal logo on the front. A strong, considered graphic on the back.",
    },
  ],
};

const galleryImages: { key: StockPhotoKey; alt: string }[] = [
  { key: "blackRack", alt: "Placeholder photo: black tees hanging on a rail" },
  { key: "manBlackTeeWall", alt: "Placeholder photo: model wearing a plain black tee" },
  { key: "womanBlackTeeWall", alt: "Placeholder photo: model in a black top by a block wall" },
  { key: "blackTeesHangers", alt: "Placeholder photo: black tees on hangers" },
  { key: "womanWhiteTee", alt: "Placeholder photo: model wearing a plain white tee" },
  { key: "whiteTeeHanger", alt: "Placeholder photo: a white tee on a hanger" },
];

export const mockSocialGallery: SocialGallery = {
  /** PLACEHOLDER handle — replace with the real account once supplied. */
  handle: "@jygs.clothing",
  profileUrl: null,
  images: galleryImages.map((img, i) => ({
    id: `00000000-0000-4000-8008-${(i + 1).toString().padStart(12, "0")}`,
    imageUrl: stockPhoto(img.key, 800),
    imageAlt: img.alt,
  })),
};

/** Section visibility and order — admin-configurable from M3. Newsletter is deferred (brief §3). */
export const mockHomepageSections: HomepageSection[] = [
  { key: "announcement", isVisible: true, sortOrder: 0 },
  { key: "hero", isVisible: true, sortOrder: 1 },
  { key: "shop_by_category", isVisible: true, sortOrder: 2 },
  { key: "new_arrivals", isVisible: true, sortOrder: 3 },
  { key: "featured_collection", isVisible: true, sortOrder: 4 },
  { key: "best_sellers", isVisible: true, sortOrder: 5 },
  { key: "brand_story", isVisible: true, sortOrder: 6 },
  { key: "social_gallery", isVisible: true, sortOrder: 7 },
  { key: "newsletter", isVisible: false, sortOrder: 8 },
];

/** Contact and social details are PLACEHOLDERS (null) until supplied by the owner. */
export const mockStoreSettings: StoreSettings = {
  announcementText: "New season oversized tees have landed — premium heavyweight cotton",
  contactEmail: null,
  contactPhone: null,
  whatsappNumber: null,
  address: null,
  socialLinks: [],
};
