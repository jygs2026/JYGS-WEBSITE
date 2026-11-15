import { describe, expect, it } from "vitest";

import { mockProducts } from "@/mocks/catalog";
import type { ProductWithDetails } from "@/types";

import { findVariant, getVariantAvailability, getVariantById } from "./catalog";

const signature = mockProducts.find((p) => p.slug === "signature-oversized-tee")!;
const orbit = mockProducts.find((p) => p.slug === "orbit-back-print-tee")!;
const colourId = (p: ProductWithDetails, slug: string) =>
  p.variants.find((v) => v.colour.slug === slug)!.colourId;

describe("findVariant", () => {
  it("finds the variant for a colour + size", () => {
    const v = findVariant(signature, colourId(signature, "white"), "M");
    expect(v?.colour.slug).toBe("white");
    expect(v?.size.label).toBe("M");
    expect(v?.productId).toBe(signature.id);
  });

  it("returns undefined without a colour or size", () => {
    expect(findVariant(signature, null, "M")).toBeUndefined();
    expect(findVariant(signature, colourId(signature, "black"), null)).toBeUndefined();
  });

  it("returns undefined for a size the colourway does not offer (no substitution)", () => {
    // Orbit Back Print Tee is offered S–XL only.
    expect(findVariant(orbit, colourId(orbit, "pine-green"), "XS")).toBeUndefined();
  });

  it("returns undefined for a colour belonging to another product", () => {
    expect(findVariant(signature, colourId(orbit, "pine-green"), "M")).toBeUndefined();
  });

  it("ignores inactive variants", () => {
    const target = findVariant(signature, colourId(signature, "black"), "L")!;
    const withInactive: ProductWithDetails = {
      ...signature,
      variants: signature.variants.map((v) => (v.id === target.id ? { ...v, isActive: false } : v)),
    };
    expect(findVariant(withInactive, target.colourId, "L")).toBeUndefined();
  });
});

describe("getVariantById", () => {
  it("returns the variant with that ID", () => {
    const target = signature.variants[3];
    expect(getVariantById(signature, target.id)).toBe(target);
  });

  it("returns undefined for an unknown ID or another product's variant", () => {
    expect(getVariantById(signature, "missing")).toBeUndefined();
    expect(getVariantById(signature, orbit.variants[0].id)).toBeUndefined();
  });
});

describe("getVariantAvailability", () => {
  it("maps a variant to demo-stock availability for cart operations", () => {
    const whiteM = findVariant(signature, colourId(signature, "white"), "M")!; // demo stock 2
    expect(getVariantAvailability(signature, whiteM)).toEqual({
      variantId: whiteM.id,
      productId: signature.id,
      available: 2,
      isActive: true,
    });
  });

  it("reports sold-out variants with available 0", () => {
    const whiteXs = findVariant(signature, colourId(signature, "white"), "XS")!; // demo sold out
    expect(getVariantAvailability(signature, whiteXs)?.available).toBe(0);
  });

  it("returns null for a missing variant or one from another product", () => {
    expect(getVariantAvailability(signature, undefined)).toBeNull();
    expect(getVariantAvailability(signature, orbit.variants[0])).toBeNull();
  });

  it("never reports negative stock", () => {
    const v = signature.variants[0];
    const negative = { ...v, inventory: { ...v.inventory, quantity: -3 } };
    expect(getVariantAvailability(signature, negative)?.available).toBe(0);
  });
});
