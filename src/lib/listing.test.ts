import { describe, expect, it } from "vitest";

import { mockProducts } from "@/mocks/catalog";

import {
  applyListing,
  countActiveFilters,
  emptyFilters,
  filterProducts,
  matchesQuery,
  MAX_QUERY_LENGTH,
  parseListingParams,
  pickDisplayColourId,
  sortProducts,
  toSearchParams,
} from "./listing";

const published = mockProducts.filter((p) => p.status === "published");
const names = (list: typeof published) => list.map((p) => p.name);
const CATEGORIES = ["men", "women", "unisex"];

describe("parseListingParams", () => {
  it("returns defaults for empty params", () => {
    expect(parseListingParams({})).toEqual(emptyFilters());
  });

  it("parses every supported parameter", () => {
    const f = parseListingParams(
      {
        q: "  orbit   tee ",
        category: "men,women",
        fit: "boxy",
        colour: "cherry,black",
        size: "m,xl",
        gsm: "250,260",
        price: "1500-1699",
        stock: "in",
        sort: "price-asc",
      },
      {},
      { categorySlugs: CATEGORIES },
    );
    expect(f).toEqual({
      q: "orbit tee",
      categories: ["men", "women"],
      fits: ["Boxy"],
      colours: ["black", "cherry"],
      sizes: ["M", "XL"],
      gsm: [250, 260],
      prices: ["1500-1699"],
      inStock: true,
      sort: "price-asc",
    });
  });

  it("drops unknown, malformed and disallowed values", () => {
    const f = parseListingParams(
      {
        category: "kids,constructor",
        fit: "regular,slim",
        colour: "red,heather-grey",
        size: "xxl,xxs",
        gsm: "180,300,abc,250.5",
        price: "free",
        stock: "yes",
        sort: "random",
      },
      {},
      { categorySlugs: CATEGORIES },
    );
    expect(f).toEqual(emptyFilters());
  });

  it("never accepts XXL", () => {
    expect(parseListingParams({ size: "XXL" }).sizes).toEqual([]);
  });

  it("handles repeated params and caps the search length", () => {
    const f = parseListingParams({ colour: ["black", "plum"], q: "x".repeat(200) });
    expect(f.colours).toEqual(["black", "plum"]);
    expect(f.q).toHaveLength(MAX_QUERY_LENGTH);
  });

  it("uses the scope default sort and ignores category params on category pages", () => {
    const f = parseListingParams(
      { category: "women" },
      { category: "men", defaultSort: "newest" },
      { categorySlugs: CATEGORIES },
    );
    expect(f.categories).toEqual([]);
    expect(f.sort).toBe("newest");
  });
});

describe("toSearchParams", () => {
  it("round-trips through parseListingParams", () => {
    const original = parseListingParams(
      { q: "boxy", fit: "oversized", colour: "plum", size: "s", stock: "in", sort: "newest" },
      {},
      { categorySlugs: CATEGORIES },
    );
    const raw = Object.fromEntries(toSearchParams(original));
    expect(parseListingParams(raw, {}, { categorySlugs: CATEGORIES })).toEqual(original);
  });

  it("omits defaults", () => {
    expect(toSearchParams(emptyFilters()).toString()).toBe("");
    expect(toSearchParams(emptyFilters("newest"), { defaultSort: "newest" }).toString()).toBe("");
  });
});

describe("matchesQuery", () => {
  it("matches every word, case- and accent-insensitively", () => {
    expect(matchesQuery("Orbit Back Print Tee", "ORBIT tee")).toBe(true);
    expect(matchesQuery("Orbit Back Print Tee", "órbit")).toBe(true);
    expect(matchesQuery("Orbit Back Print Tee", "orbit hoodie")).toBe(false);
    expect(matchesQuery("Anything", "   ")).toBe(true);
  });
});

describe("filterProducts", () => {
  it("excludes nothing when no filters are set", () => {
    expect(filterProducts(published, emptyFilters())).toHaveLength(published.length);
  });

  it("searches product names", () => {
    const result = filterProducts(published, { ...emptyFilters(), q: "monogram" });
    expect(names(result)).toEqual(["Monogram Back Graphic Tee", "Pine Monogram Oversized Tee"]);
  });

  it("filters by fit, GSM and category", () => {
    const boxy = filterProducts(published, { ...emptyFilters(), fits: ["Boxy"] });
    expect(boxy.every((p) => p.fit === "Boxy")).toBe(true);
    const heavy = filterProducts(published, { ...emptyFilters(), gsm: [260] });
    expect(heavy.every((p) => p.gsm === 260)).toBe(true);
    const women = filterProducts(published, { ...emptyFilters(), categories: ["women"] });
    expect(women.every((p) => p.category.slug === "women")).toBe(true);
  });

  it("filters by colour and price band", () => {
    const cherry = filterProducts(published, { ...emptyFilters(), colours: ["cherry"] });
    expect(cherry.every((p) => p.variants.some((v) => v.colour.slug === "cherry"))).toBe(true);
    const under = filterProducts(published, { ...emptyFilters(), prices: ["under-1500"] });
    expect(under.every((p) => p.price < 150_000)).toBe(true);
  });

  it("applies size + colour together (White sold out in XS on the Signature tee)", () => {
    const whiteXs = filterProducts(published, {
      ...emptyFilters(),
      colours: ["white"],
      sizes: ["XS"],
    });
    expect(names(whiteXs)).not.toContain("Signature Oversized Tee");
    const blackXs = filterProducts(published, {
      ...emptyFilters(),
      colours: ["black"],
      sizes: ["XS"],
    });
    expect(names(blackXs)).toContain("Signature Oversized Tee");
  });

  it("hides sold-out products when 'in stock only' is on", () => {
    const all = names(filterProducts(published, emptyFilters()));
    const inStock = names(filterProducts(published, { ...emptyFilters(), inStock: true }));
    expect(all).toContain("Pine Monogram Oversized Tee");
    expect(inStock).not.toContain("Pine Monogram Oversized Tee");
  });

  it("respects collection and category scopes", () => {
    const newIn = filterProducts(published, emptyFilters(), { collection: "new-arrivals" });
    expect(newIn.every((p) => p.isNewArrival)).toBe(true);
    const men = filterProducts(published, emptyFilters(), { category: "men" });
    expect(men.every((p) => p.category.slug === "men")).toBe(true);
  });
});

describe("sortProducts", () => {
  it("sorts by price both ways", () => {
    const asc = sortProducts(published, "price-asc").map((p) => p.price);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = sortProducts(published, "price-desc").map((p) => p.price);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  it("sorts newest first and puts featured products first", () => {
    const newest = sortProducts(published, "newest").map((p) => p.createdAt);
    expect(newest).toEqual([...newest].sort().reverse());
    const featured = sortProducts(published, "featured");
    const firstNonFeatured = featured.findIndex((p) => !p.isFeatured);
    expect(featured.slice(firstNonFeatured).some((p) => p.isFeatured)).toBe(false);
  });

  it("does not mutate the input", () => {
    const copy = [...published];
    sortProducts(published, "price-desc");
    expect(published).toEqual(copy);
  });
});

describe("helpers", () => {
  it("counts active filters (search and sort excluded)", () => {
    expect(countActiveFilters(emptyFilters())).toBe(0);
    expect(
      countActiveFilters({
        ...emptyFilters("price-asc"),
        q: "tee",
        colours: ["black", "plum"],
        inStock: true,
      }),
    ).toBe(3);
  });

  it("picks the filtered colourway for product cards", () => {
    const signature = published.find((p) => p.slug === "signature-oversized-tee")!;
    const white = signature.variants.find((v) => v.colour.slug === "white")!.colourId;
    expect(pickDisplayColourId(signature, { ...emptyFilters(), colours: ["white"] })).toBe(white);
    expect(pickDisplayColourId(signature, emptyFilters())).toBeNull();
  });

  it("applyListing filters then sorts", () => {
    const result = applyListing(published, { ...emptyFilters("price-asc"), fits: ["Oversized"] });
    expect(result.every((p) => p.fit === "Oversized")).toBe(true);
    expect(result.map((p) => p.price)).toEqual(
      [...result.map((p) => p.price)].sort((a, b) => a - b),
    );
  });
});
