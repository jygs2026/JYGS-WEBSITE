import { describe, expect, it } from "vitest";

import { acceptsHeartClick } from "./heart-click";

describe("acceptsHeartClick", () => {
  it("ignores every click while the heart has not shown its loaded state", () => {
    expect(acceptsHeartClick(null, 0)).toBe(false);
    expect(acceptsHeartClick(null, 123_456)).toBe(false);
  });

  it("ignores clicks that arrived before the loaded state was shown", () => {
    // e.g. a click on a still-"loading" heart, delivered after React hydrated it synchronously
    expect(acceptsHeartClick(1_000, 999.9)).toBe(false);
    expect(acceptsHeartClick(1_000, 10)).toBe(false);
  });

  it("accepts clicks that arrived once the loaded state was on the page", () => {
    expect(acceptsHeartClick(1_000, 1_000)).toBe(true);
    expect(acceptsHeartClick(1_000, 1_000.1)).toBe(true);
    expect(acceptsHeartClick(1_000, 60_000)).toBe(true);
  });
});
