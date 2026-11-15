import { siteConfig } from "@/config/site";

const currency = { style: "currency", currency: siteConfig.currency } as const;
/** Whole rupees: "₹1,499". */
const wholeRupees = new Intl.NumberFormat(siteConfig.locale, {
  ...currency,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
/** With paise: always two digits, "₹1,499.50" (never "₹1,499.5"). */
const withPaise = new Intl.NumberFormat(siteConfig.locale, {
  ...currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a price stored as integer paise (₹1 = 100 paise) for display, e.g. 149900 → "₹1,499",
 * 149950 → "₹1,499.50". All money is stored and computed in integer paise to avoid
 * floating-point rounding errors; division happens only here, for display.
 */
export function formatPrice(paise: number): string {
  const whole = Math.round(paise);
  return (whole % 100 === 0 ? wholeRupees : withPaise).format(whole / 100);
}

/** Converts a rupee amount entered by a person (e.g. in an admin form) to integer paise. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
