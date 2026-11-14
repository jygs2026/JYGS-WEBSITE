import {
  GSM_RANGE,
  JYGS_COLOURS,
  PRODUCT_FABRIC,
  PRODUCT_FITS,
  SIZE_LABELS,
} from "@/config/product-info";
import type { ProductWithDetails } from "@/types";

/**
 * Returns a human-readable list of JYGS brand-rule violations in catalogue data.
 * An empty array means the catalogue is compliant.
 *
 * Rules: 100% Compact Cotton, Oversized/Boxy fit only, 240–260 GSM, XS–XL sizes only,
 * approved colourways only, front + back imagery for every offered colour, unique slugs.
 */
export function findBrandRuleViolations(products: ProductWithDetails[]): string[] {
  const errors: string[] = [];
  const colourSlugs = new Set<string>(JYGS_COLOURS.map((c) => c.slug));
  const sizes = new Set<string>(SIZE_LABELS);
  const fits = new Set<string>(PRODUCT_FITS);
  const seenSlugs = new Set<string>();

  for (const p of products) {
    const where = `"${p.slug}"`;
    if (seenSlugs.has(p.slug)) errors.push(`${where}: duplicate slug`);
    seenSlugs.add(p.slug);

    if (p.fabric !== PRODUCT_FABRIC) errors.push(`${where}: fabric must be "${PRODUCT_FABRIC}"`);
    if (!fits.has(p.fit)) errors.push(`${where}: fit "${p.fit}" is not Oversized or Boxy`);
    if (!Number.isInteger(p.gsm) || p.gsm < GSM_RANGE.min || p.gsm > GSM_RANGE.max) {
      errors.push(`${where}: GSM ${p.gsm} is outside ${GSM_RANGE.min}–${GSM_RANGE.max}`);
    }

    const offeredColourIds = new Set<string>();
    for (const v of p.variants) {
      if (!sizes.has(v.size.label)) errors.push(`${where}: size "${v.size.label}" is not allowed`);
      if (!colourSlugs.has(v.colour.slug)) {
        errors.push(`${where}: colour "${v.colour.name}" is not a JYGS colourway`);
      }
      if (v.inventory.quantity < 0) errors.push(`${where}: negative stock for ${v.sku}`);
      offeredColourIds.add(v.colourId);
    }

    for (const colourId of offeredColourIds) {
      const views = new Set(p.images.filter((i) => i.colourId === colourId).map((i) => i.view));
      if (!views.has("front") || !views.has("back")) {
        errors.push(`${where}: missing front/back image for colour ${colourId}`);
      }
    }
  }

  return errors;
}
