/**
 * JYGS product direction — the single source of truth for brand rules shown on product
 * pages and enforced on catalogue data (see src/lib/brand-rules.ts).
 */
import type { ProductFit, SizeLabel } from "@/types";

export const PRODUCT_FABRIC = "100% Compact Cotton";

export const PRODUCT_FITS = ["Oversized", "Boxy"] as const satisfies readonly ProductFit[];

export const GSM_RANGE = { min: 240, max: 260 } as const;

/** The full JYGS size run, in display order. */
export const SIZE_LABELS = ["XS", "S", "M", "L", "XL"] as const satisfies readonly SizeLabel[];

/** JYGS collection colourways, in display order. Hex values are swatch approximations. */
export const JYGS_COLOURS = [
  { slug: "black", name: "Black", hex: "#151515" },
  { slug: "off-white", name: "Off-White", hex: "#EEE9DD" },
  { slug: "cherry", name: "Cherry", hex: "#7A1F2B" },
  { slug: "pine-green", name: "Pine Green", hex: "#1F3B2E" },
  { slug: "me-lavender", name: "ME Lavender", hex: "#B8A9CF" },
  { slug: "plum", name: "Plum", hex: "#4A2340" },
  { slug: "white", name: "White", hex: "#FAFAF7" },
] as const;

export type JygsColourSlug = (typeof JYGS_COLOURS)[number]["slug"];

/** Qualitative fit notes (no measurements — those come from JYGS). */
export const FIT_NOTES: Record<ProductFit, string> = {
  Oversized: "Dropped shoulders and a relaxed, longer body for an easy, roomy drape.",
  Boxy: "A wide, square body with dropped shoulders for a structured, boxy shape.",
};

export const PRINT_DETAILS = {
  front: "Minimal JYGS chest logo",
  back: "Strong JYGS back graphic",
} as const;
