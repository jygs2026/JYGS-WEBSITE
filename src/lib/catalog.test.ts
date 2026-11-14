import { describe, expect, it } from "vitest";

import { SIZE_LABELS } from "@/config/product-info";
import { mockProducts } from "@/mocks/catalog";
import type { ProductWithDetails } from "@/types";

import { findBrandRuleViolations } from "./brand-rules";
import {
  getCardImages,
  getColourImages,
  getColourSlug,
  getLeadColourId,
  getProductHref,
  getProductStockStatus,
  getSizeOptions,
  isColourInStock,
  resolveColourId,
} from "./catalog";

const bySlug = (slug: string) => mockProducts.find((p) => p.slug === slug)!;
const colourId = (p: ProductWithDetails, slug: string) =>
  p.variants.find((v) => v.colour.slug === slug)!.colourId;

describe("JYGS brand rules", () => {
  it("the demo catalogue is fully compliant", () => {
    expect(findBrandRuleViolations(mockProducts)).toEqual([]);
  });

  it("only offers XS–XL", () => {
    expect(SIZE_LABELS).toEqual(["XS", "S", "M", "L", "XL"]);
    const sizes = new Set(mockProducts.flatMap((p) => p.variants.map((v) => v.size.label)));
    expect(sizes.has("XXL" as never)).toBe(false);
  });

  it("flags violations", () => {
    const base = bySlug("signature-oversized-tee");
    const bad: ProductWithDetails = {
      ...base,
      fabric: "Polyester",
      fit: "Regular" as never,
      gsm: 180,
      images: [],
    };
    const errors = findBrandRuleViolations([bad, base]);
    expect(errors.join("\n")).toMatch(/fabric/);
    expect(errors.join("\n")).toMatch(/fit "Regular"/);
    expect(errors.join("\n")).toMatch(/GSM 180/);
    expect(errors.join("\n")).toMatch(/missing front\/back image/);
    expect(errors.join("\n")).toMatch(/duplicate slug/);
  });
});

describe("colour-aware helpers", () => {
  const signature = bySlug("signature-oversized-tee");

  it("uses the lead colourway by default", () => {
    expect(getLeadColourId(signature)).toBe(colourId(signature, "black"));
  });

  it("returns front then back images for a colourway", () => {
    const images = getColourImages(signature, colourId(signature, "white"));
    expect(images.map((i) => i.view)).toEqual(["front", "back"]);
    expect(images[0].url).toContain("tee-white-front");
  });

  it("product cards can show a specific colourway", () => {
    const { primary, hover } = getCardImages(signature, colourId(signature, "off-white"));
    expect(primary?.url).toContain("off-white-front");
    expect(hover?.url).toContain("off-white-back");
  });

  it("size availability changes with colour", () => {
    const black = getSizeOptions(signature, colourId(signature, "black"));
    const white = getSizeOptions(signature, colourId(signature, "white"));
    expect(black.map((s) => s.label)).toEqual(SIZE_LABELS);
    expect(black.find((s) => s.label === "XS")?.status).toBe("in_stock");
    expect(white.find((s) => s.label === "XS")?.status).toBe("out_of_stock");
    expect(white.find((s) => s.label === "M")?.status).toBe("low_stock");
  });

  it("marks sizes not offered as unavailable", () => {
    const orbit = bySlug("orbit-back-print-tee");
    const options = getSizeOptions(orbit, colourId(orbit, "pine-green"));
    expect(options.find((s) => s.label === "XS")?.status).toBe("unavailable");
  });

  it("resolves a requested ?colour= to the product's colourway", () => {
    expect(resolveColourId(signature, "white")).toBe(colourId(signature, "white"));
    expect(resolveColourId(signature, "off-white")).toBe(colourId(signature, "off-white"));
    // Case-insensitive, whitespace-tolerant, first value of a repeated param.
    expect(resolveColourId(signature, "  WHITE ")).toBe(colourId(signature, "white"));
    expect(resolveColourId(signature, ["white", "black"])).toBe(colourId(signature, "white"));
  });

  it("falls back to the default colour for invalid or unavailable colours", () => {
    const lead = colourId(signature, "black");
    expect(resolveColourId(signature, undefined)).toBe(lead);
    expect(resolveColourId(signature, null)).toBe(lead);
    expect(resolveColourId(signature, "")).toBe(lead);
    expect(resolveColourId(signature, "purple")).toBe(lead); // not a JYGS colour
    expect(resolveColourId(signature, "plum")).toBe(lead); // JYGS colour, not offered here
    expect(resolveColourId(signature, "<script>")).toBe(lead);
    expect(resolveColourId(signature, [])).toBe(lead);
  });

  it("builds product links with and without a colour", () => {
    expect(getProductHref(signature)).toBe("/product/signature-oversized-tee");
    expect(getProductHref(signature, null)).toBe("/product/signature-oversized-tee");
    expect(getProductHref(signature, colourId(signature, "white"))).toBe(
      "/product/signature-oversized-tee?colour=white",
    );
    expect(getProductHref(signature, colourId(signature, "black"))).toBe(
      "/product/signature-oversized-tee?colour=black",
    );
    expect(getProductHref(signature, "not-a-colour-id")).toBe("/product/signature-oversized-tee");
    expect(getColourSlug(signature, colourId(signature, "off-white"))).toBe("off-white");
  });

  it("a requested colour drives images and size availability", () => {
    const white = resolveColourId(signature, "white");
    expect(getColourImages(signature, white).map((i) => i.url)).toEqual([
      "/demo/tees/tee-white-front.svg",
      "/demo/tees/tee-white-back-stack.svg",
    ]);
    const sizes = getSizeOptions(signature, white);
    expect(sizes.filter((s) => s.status === "out_of_stock").map((s) => s.label)).toEqual([
      "XS",
      "S",
    ]);
  });

  it("detects sold-out products and colourways", () => {
    const pine = bySlug("pine-monogram-oversized-tee");
    expect(getProductStockStatus(pine)).toBe("out_of_stock");
    expect(isColourInStock(pine, colourId(pine, "pine-green"))).toBe(false);
  });
});
