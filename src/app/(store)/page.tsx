import { Fragment, type ReactNode } from "react";

import { BrandStory } from "@/components/store/home/brand-story";
import { CampaignFeature } from "@/components/store/home/campaign-feature";
import { CategoryTiles } from "@/components/store/home/category-tiles";
import { Hero } from "@/components/store/home/hero";
import { ProductSection } from "@/components/store/home/product-section";
import { SocialGallery } from "@/components/store/home/social-gallery";
import { getBestSellers, getNewArrivals, getVisibleCategories } from "@/services/catalog";
import { getHomepageContent } from "@/services/content";
import type { HomepageSectionKey } from "@/types";

export default async function HomePage() {
  const [content, categories, newArrivals, bestSellers] = await Promise.all([
    getHomepageContent(),
    getVisibleCategories(),
    getNewArrivals(4),
    getBestSellers(4),
  ]);

  // Section order and visibility come from content data (admin-configurable later).
  // The announcement strip is rendered by the store layout; the newsletter is deferred.
  const sections: Partial<Record<HomepageSectionKey, ReactNode>> = {
    hero: content.hero ? <Hero banner={content.hero} /> : null,
    shop_by_category: <CategoryTiles categories={categories} />,
    new_arrivals: (
      <ProductSection
        id="new-arrivals"
        eyebrow="Just landed"
        title="New Arrivals"
        products={newArrivals}
        viewAllHref="/collections/new-arrivals"
        className="pt-0 md:pt-0"
      />
    ),
    featured_collection: content.campaign ? <CampaignFeature banner={content.campaign} /> : null,
    best_sellers: (
      <ProductSection
        id="best-sellers"
        eyebrow="Most loved"
        title="Best Sellers"
        products={bestSellers}
        viewAllHref="/collections/best-sellers"
      />
    ),
    brand_story: <BrandStory story={content.brandStory} />,
    social_gallery: <SocialGallery gallery={content.socialGallery} />,
  };

  return (
    <>
      {content.sections.map((section) => (
        <Fragment key={section.key}>{sections[section.key] ?? null}</Fragment>
      ))}
    </>
  );
}
