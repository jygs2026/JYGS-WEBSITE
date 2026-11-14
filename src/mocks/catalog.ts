/**
 * DEMO PLACEHOLDER CATALOGUE — PREMIUM OVERSIZED / BOXY T-SHIRTS ONLY.
 *
 * Reflects the JYGS product direction:
 * - Oversized or boxy fit only (no regular, cropped or raglan styles).
 * - 100% compact cotton, 240–260 GSM.
 * - Minimal front logo, strong back graphic.
 * - JYGS colourways: Black, Off-White, White, Cherry, Pine Green, ME Lavender and Plum.
 *
 * Every product name, description, price, size, stock level and image here is invented for
 * layout purposes only. Product images are generated placeholder artwork (see
 * scripts/generate-placeholder-tees.mjs). Replace with the owner's real catalogue (brief §15).
 * In M5 this file is replaced by Supabase queries behind the same service functions.
 */
import {
  JYGS_COLOURS,
  PRODUCT_FABRIC,
  SIZE_LABELS,
  type JygsColourSlug,
} from "@/config/product-info";
import { findBrandRuleViolations } from "@/lib/brand-rules";
import type {
  Category,
  Colour,
  ProductFit,
  ProductImage,
  ProductStatus,
  ProductWithDetails,
  Size,
  SizeLabel,
  VariantWithStock,
} from "@/types";

import { stockPhoto, teeArt, type BackGraphic } from "./images";

const MOCK_TIMESTAMP = "2026-11-01T00:00:00.000Z";

/** Deterministic UUID-shaped IDs so mock data is stable between renders. */
function mockId(namespace: number, n: number): string {
  return `00000000-0000-4000-8${namespace.toString().padStart(3, "0")}-${n.toString().padStart(12, "0")}`;
}

// ---------------------------------------------------------------------------
// Sizes and colours
// ---------------------------------------------------------------------------

/** XS–XL only (see SIZE_LABELS in src/config/product-info.ts). */
export const mockSizes: Size[] = SIZE_LABELS.map((label, i) => ({
  id: mockId(1, i + 1),
  label,
  sortOrder: i,
}));

/**
 * JYGS collection colourways from the brand config. Hex values are swatch approximations and
 * must stay in sync with scripts/generate-placeholder-tees.mjs.
 */
type ColourKey = JygsColourSlug;

export const mockColours: Colour[] = JYGS_COLOURS.map((c, i) => ({
  id: mockId(2, i + 1),
  name: c.name,
  slug: c.slug,
  hex: c.hex,
  sortOrder: i,
}));

const colourByKey = Object.fromEntries(mockColours.map((c) => [c.slug, c])) as Record<
  ColourKey,
  Colour
>;

const sizeByLabel = Object.fromEntries(mockSizes.map((s) => [s.label, s])) as Record<
  SizeLabel,
  Size
>;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const mockCategories: Category[] = [
  {
    id: mockId(3, 1),
    name: "Men",
    slug: "men",
    description: "Oversized tees with statement back graphics.",
    imageUrl: stockPhoto("manWhiteTeeCap", 1200),
    isVisible: true,
    sortOrder: 1,
    createdAt: MOCK_TIMESTAMP,
    updatedAt: MOCK_TIMESTAMP,
  },
  {
    id: mockId(3, 2),
    name: "Women",
    slug: "women",
    description: "Boxy tees in heavyweight compact cotton.",
    imageUrl: stockPhoto("womanBlackTee", 1200),
    isVisible: true,
    sortOrder: 2,
    createdAt: MOCK_TIMESTAMP,
    updatedAt: MOCK_TIMESTAMP,
  },
  {
    id: mockId(3, 3),
    name: "Unisex",
    slug: "unisex",
    description: "Core JYGS oversized tees, designed for everyone.",
    imageUrl: stockPhoto("whiteTeeModel", 1200),
    isVisible: true,
    sortOrder: 3,
    createdAt: MOCK_TIMESTAMP,
    updatedAt: MOCK_TIMESTAMP,
  },
];

type CategorySlug = "men" | "women" | "unisex";
const categoryBySlug = Object.fromEntries(mockCategories.map((c) => [c.slug, c])) as Record<
  CategorySlug,
  Category
>;

// ---------------------------------------------------------------------------
// Products (premium oversized / boxy tees only)
// ---------------------------------------------------------------------------

type JygsGsm = 240 | 250 | 260;

interface MockProductInput {
  n: number;
  name: string;
  slug: string;
  description: string;
  category: CategorySlug;
  /** Rupees — converted to paise below. */
  price: number;
  compareAtPrice?: number;
  status?: ProductStatus;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isFeatured?: boolean;
  fit: ProductFit;
  gsm: JygsGsm;
  /** Placeholder back-graphic style shown on the back view. */
  backGraphic: BackGraphic;
  createdAt: string;
  /** First colour is the lead colourway (primary image). */
  colours: [ColourKey, ...ColourKey[]];
  /** Stock per size, applied to every colour. Sizes not listed are not offered. */
  stock: Partial<Record<SizeLabel, number>>;
  /** Optional per-colour stock overrides, e.g. a size sold out in one colourway only. */
  stockOverrides?: Partial<Record<ColourKey, Partial<Record<SizeLabel, number>>>>;
}

function buildProduct(input: MockProductInput): ProductWithDetails {
  const productId = mockId(4, input.n);
  const fitLabel = input.fit.toLowerCase();

  // Front + back placeholder artwork for every offered colourway; lead colour front is primary.
  const images: ProductImage[] = input.colours.flatMap((colourKey, c) => {
    const colour = colourByKey[colourKey];
    return [
      {
        id: mockId(5, input.n * 100 + c * 2),
        productId,
        colourId: colour.id,
        view: "front" as const,
        url: teeArt(colourKey, "front"),
        alt: `Placeholder artwork: front of a ${colour.name} ${fitLabel} tee with a small JYGS chest logo`,
        sortOrder: c * 2,
        isPrimary: c === 0,
      },
      {
        id: mockId(5, input.n * 100 + c * 2 + 1),
        productId,
        colourId: colour.id,
        view: "back" as const,
        url: teeArt(colourKey, "back", input.backGraphic),
        alt: `Placeholder artwork: back of a ${colour.name} ${fitLabel} tee with a large JYGS graphic`,
        sortOrder: c * 2 + 1,
        isPrimary: false,
      },
    ];
  });

  let variantIndex = 0;
  const variants: VariantWithStock[] = input.colours.flatMap((colourKey) =>
    (Object.entries(input.stock) as [SizeLabel, number][]).map(([sizeLabel, baseQuantity]) => {
      variantIndex += 1;
      const quantity = input.stockOverrides?.[colourKey]?.[sizeLabel] ?? baseQuantity;
      const id = mockId(6, input.n * 100 + variantIndex);
      return {
        id,
        productId,
        sizeId: sizeByLabel[sizeLabel].id,
        colourId: colourByKey[colourKey].id,
        sku: `JYGS-${input.n.toString().padStart(3, "0")}-${colourKey.toUpperCase()}-${sizeLabel}`,
        priceOverride: null,
        isActive: true,
        size: sizeByLabel[sizeLabel],
        colour: colourByKey[colourKey],
        inventory: {
          variantId: id,
          quantity,
          lowStockThreshold: 3,
          updatedAt: input.createdAt,
        },
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      };
    }),
  );

  return {
    id: productId,
    name: input.name,
    slug: input.slug,
    description: input.description,
    categoryId: categoryBySlug[input.category].id,
    category: categoryBySlug[input.category],
    price: input.price * 100,
    compareAtPrice: input.compareAtPrice ? input.compareAtPrice * 100 : null,
    status: input.status ?? "published",
    isNewArrival: input.isNewArrival ?? false,
    isBestSeller: input.isBestSeller ?? false,
    isFeatured: input.isFeatured ?? false,
    fabric: PRODUCT_FABRIC,
    fit: input.fit,
    gsm: input.gsm,
    images,
    variants,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

const fullRun = { XS: 6, S: 12, M: 18, L: 15, XL: 9 } satisfies Partial<Record<SizeLabel, number>>;
const lowRun = { S: 2, M: 3, L: 1, XL: 2 } satisfies Partial<Record<SizeLabel, number>>;

export const mockProducts: ProductWithDetails[] = [
  buildProduct({
    n: 1,
    name: "Signature Oversized Tee",
    slug: "signature-oversized-tee",
    description:
      "The JYGS signature: a dropped-shoulder oversized tee with a small chest logo and a bold wordmark across the back.",
    category: "unisex",
    price: 1499,
    isNewArrival: true,
    isFeatured: true,
    fit: "Oversized",
    gsm: 240,
    backGraphic: "stack",
    createdAt: "2026-11-10T00:00:00.000Z",
    colours: ["black", "off-white", "white"],
    stock: fullRun,
    // Demo: White sold out in XS/S, low in M — size availability changes with colour.
    stockOverrides: { white: { XS: 0, S: 0, M: 2 } },
  }),
  buildProduct({
    n: 2,
    name: "Monogram Back Graphic Tee",
    slug: "monogram-back-graphic-tee",
    description: "A boxy tee carrying a framed four-letter JYGS monogram across the upper back.",
    category: "unisex",
    price: 1699,
    compareAtPrice: 1999,
    isNewArrival: true,
    isFeatured: true,
    fit: "Boxy",
    gsm: 250,
    backGraphic: "monogram",
    createdAt: "2026-11-08T00:00:00.000Z",
    colours: ["cherry", "black"],
    stock: lowRun,
  }),
  buildProduct({
    n: 3,
    name: "Orbit Back Print Tee",
    slug: "orbit-back-print-tee",
    description:
      "Heavyweight 260 GSM oversized tee with a circular JYGS badge printed on the back.",
    category: "men",
    price: 1799,
    isNewArrival: true,
    fit: "Oversized",
    gsm: 260,
    backGraphic: "orbit",
    createdAt: "2026-11-06T00:00:00.000Z",
    colours: ["pine-green", "black", "off-white"],
    stock: { S: 6, M: 10, L: 10, XL: 6 },
    stockOverrides: { "off-white": { XL: 0 } },
  }),
  buildProduct({
    n: 4,
    name: "Repeat Logo Boxy Tee",
    slug: "repeat-logo-boxy-tee",
    description: "A boxy tee with a repeating, fading JYGS wordmark running down the back.",
    category: "women",
    price: 1599,
    isNewArrival: true,
    fit: "Boxy",
    gsm: 240,
    backGraphic: "repeat",
    createdAt: "2026-11-04T00:00:00.000Z",
    colours: ["me-lavender", "off-white", "black"],
    stock: { XS: 5, S: 9, M: 11, L: 6, XL: 2 },
  }),
  buildProduct({
    n: 5,
    name: "Essential Boxy Tee — Black",
    slug: "essential-boxy-tee-black",
    description:
      "Our best-selling boxy silhouette in deep black, with a framed monogram on the back.",
    category: "unisex",
    price: 1299,
    isBestSeller: true,
    fit: "Boxy",
    gsm: 240,
    backGraphic: "monogram",
    createdAt: "2026-09-02T00:00:00.000Z",
    colours: ["black"],
    stock: fullRun,
  }),
  buildProduct({
    n: 6,
    name: "Plum Orbit Boxy Tee",
    slug: "plum-orbit-boxy-tee",
    description: "A boxy plum tee with the circular JYGS badge on the back.",
    category: "women",
    price: 1699,
    compareAtPrice: 1899,
    isBestSeller: true,
    fit: "Boxy",
    gsm: 250,
    backGraphic: "orbit",
    createdAt: "2026-08-20T00:00:00.000Z",
    colours: ["plum", "black"],
    stock: lowRun,
  }),
  buildProduct({
    n: 7,
    name: "Heavyweight Oversized Tee — Off-White",
    slug: "heavyweight-oversized-tee-off-white",
    description:
      "A dense 260 GSM oversized tee in off-white with the stacked JYGS wordmark on the back.",
    category: "unisex",
    price: 1599,
    isBestSeller: true,
    fit: "Oversized",
    gsm: 260,
    backGraphic: "stack",
    createdAt: "2026-08-01T00:00:00.000Z",
    colours: ["off-white", "white"],
    stock: { S: 4, M: 7, L: 7, XL: 3 },
  }),
  buildProduct({
    n: 8,
    name: "Pine Monogram Oversized Tee",
    slug: "pine-monogram-oversized-tee",
    description: "Pine green oversized tee with the framed JYGS monogram across the back.",
    category: "men",
    price: 1699,
    isBestSeller: true,
    fit: "Oversized",
    gsm: 260,
    backGraphic: "monogram",
    createdAt: "2026-07-15T00:00:00.000Z",
    colours: ["pine-green"],
    stock: { S: 0, M: 0, L: 0, XL: 0 },
  }),
  buildProduct({
    n: 9,
    name: "Cherry Repeat Logo Tee",
    slug: "cherry-repeat-logo-tee",
    description: "Oversized cherry tee with the repeating JYGS wordmark down the back.",
    category: "men",
    price: 1599,
    fit: "Oversized",
    gsm: 250,
    backGraphic: "repeat",
    createdAt: "2026-06-20T00:00:00.000Z",
    colours: ["cherry", "off-white"],
    stock: { M: 6, L: 8, XL: 4 },
  }),
  buildProduct({
    n: 10,
    name: "Lavender Signature Boxy Tee",
    slug: "lavender-signature-boxy-tee",
    description: "The signature stacked-wordmark back graphic on a boxy ME Lavender tee.",
    category: "women",
    price: 1499,
    fit: "Boxy",
    gsm: 240,
    backGraphic: "stack",
    createdAt: "2026-06-10T00:00:00.000Z",
    colours: ["me-lavender"],
    stock: { XS: 4, S: 6, M: 6, L: 3 },
  }),
  buildProduct({
    n: 11,
    name: "Studio Sample Tee",
    slug: "studio-sample-tee",
    description: "Unreleased sample — draft products must never appear on the storefront.",
    category: "unisex",
    price: 1299,
    status: "draft",
    isNewArrival: true,
    fit: "Oversized",
    gsm: 240,
    backGraphic: "stack",
    createdAt: "2026-11-12T00:00:00.000Z",
    colours: ["black"],
    stock: { M: 5 },
  }),
];

// Fail fast (at build/dev time) if demo data ever breaks the JYGS brand rules.
const brandRuleViolations = findBrandRuleViolations(mockProducts);
if (brandRuleViolations.length > 0) {
  throw new Error(`Mock catalogue breaks JYGS brand rules:\n- ${brandRuleViolations.join("\n- ")}`);
}
