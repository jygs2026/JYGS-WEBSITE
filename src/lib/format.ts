import { siteConfig } from "@/config/site";

const inrFormatter = new Intl.NumberFormat(siteConfig.locale, {
  style: "currency",
  currency: siteConfig.currency,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Formats a price stored as integer paise (₹1 = 100 paise) for display, e.g. 149900 → "₹1,499".
 * All money is stored and computed in paise to avoid floating-point rounding errors.
 */
export function formatPrice(paise: number): string {
  return inrFormatter.format(paise / 100);
}

/** Converts a rupee amount entered by a person (e.g. in an admin form) to integer paise. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
