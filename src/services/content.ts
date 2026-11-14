/**
 * Homepage and storefront content. Demo mock data now; Supabase-backed from M5
 * (banners, homepage_sections and store_settings tables) with the same signatures.
 */
import {
  mockBrandStory,
  mockCampaignBanner,
  mockHeroBanner,
  mockHomepageSections,
  mockSocialGallery,
  mockStoreSettings,
} from "@/mocks/content";
import type { Banner, BrandStory, HomepageSection, SocialGallery, StoreSettings } from "@/types";

export interface HomepageContent {
  sections: HomepageSection[];
  hero: Banner | null;
  campaign: Banner | null;
  brandStory: BrandStory;
  socialGallery: SocialGallery;
}

export async function getHomepageContent(): Promise<HomepageContent> {
  return {
    sections: mockHomepageSections
      .filter((s) => s.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    hero: mockHeroBanner.isVisible ? mockHeroBanner : null,
    campaign: mockCampaignBanner.isVisible ? mockCampaignBanner : null,
    brandStory: mockBrandStory,
    socialGallery: mockSocialGallery,
  };
}

export async function getStoreSettings(): Promise<StoreSettings> {
  return mockStoreSettings;
}

/** Whether a given homepage section is switched on. */
export async function isHomepageSectionVisible(key: HomepageSection["key"]): Promise<boolean> {
  return mockHomepageSections.some((s) => s.key === key && s.isVisible);
}
