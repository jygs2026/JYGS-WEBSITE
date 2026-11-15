import { describe, expect, it } from "vitest";

import { formatPrice, rupeesToPaise } from "./format";

describe("formatPrice (integer paise → INR)", () => {
  it("shows whole rupees without decimals (unchanged M1/M2 output)", () => {
    expect(formatPrice(149_900)).toBe("₹1,499");
    expect(formatPrice(0)).toBe("₹0");
    expect(formatPrice(100_000_000)).toBe("₹10,00,000"); // Indian digit grouping
  });

  it("shows paise with exactly two digits", () => {
    expect(formatPrice(149_950)).toBe("₹1,499.50");
    expect(formatPrice(149_905)).toBe("₹1,499.05");
    expect(formatPrice(1)).toBe("₹0.01");
  });

  it("rounds stray fractional paise instead of showing float artefacts", () => {
    expect(formatPrice(0.1 * 3 * 100)).toBe("₹0.30");
  });

  it("converts entered rupees to integer paise", () => {
    expect(rupeesToPaise(1499.5)).toBe(149_950);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
  });
});
