import type { Page } from "@playwright/test";

import { closeFilters, expect, openFilters, productCards, test } from "./fixtures";

/**
 * Guards against a "flash of the wrong colour": opening /product/…?colour=white — directly or by
 * clicking a colour-filtered shop card — must never put the default (Black) colourway into the
 * page: not in the HTML response and not in the DOM at any moment.
 */
const PRODUCT = "/product/signature-oversized-tee";

type Seen = { labels: string[]; images: string[] };

/** Records every product colour label and gallery colour the DOM ever contains. */
async function recordProductColours(page: Page) {
  await page.addInitScript(() => {
    const seen = { labels: new Set<string>(), images: new Set<string>() };
    const w = window as unknown as {
      __seen: typeof seen;
      __resetSeen: () => void;
    };
    w.__seen = seen;
    w.__resetSeen = () => {
      seen.labels.clear();
      seen.images.clear();
    };
    const scan = () => {
      document.querySelectorAll("legend").forEach((el) => {
        const text = el.textContent ?? "";
        if (text.startsWith("Colour:")) seen.labels.add(text.replace("Colour:", "").trim());
      });
      document.querySelectorAll('section[aria-label$=" images"] img').forEach((img) => {
        const src = img.getAttribute("src") ?? "";
        const match = src.match(/tee-([a-z-]+)-(front|back)/);
        if (match) seen.images.add(match[1]);
      });
    };
    new MutationObserver(scan).observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["src"],
    });
    document.addEventListener("DOMContentLoaded", scan);
  });
}

async function seenColours(page: Page): Promise<Seen> {
  return page.evaluate(() => {
    const s = (window as unknown as { __seen: { labels: Set<string>; images: Set<string> } })
      .__seen;
    return { labels: [...s.labels], images: [...s.images] };
  });
}

test.describe("Requested colour renders without a default-colour flash", () => {
  test("the HTML response contains only the requested colourway", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "HTTP-level check runs once");
    const res = await request.get(`${PRODUCT}?colour=white`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    // The main product area (everything before "You may also like", whose cards show other tees).
    const productArea = html.split('id="related"')[0];
    expect(productArea).toContain("tee-white-front");
    expect(productArea).toContain("tee-white-back-stack");
    expect(productArea).toMatch(/Colour: <span[^>]*>White/);
    // No Black gallery image / Black selection anywhere in it (no default-colour fallback).
    expect(productArea).not.toContain("tee-black-front");
    expect(productArea).not.toMatch(/Colour: <span[^>]*>Black/);
    // SEO unchanged: canonical stays the plain product URL.
    expect(html).toMatch(/<link rel="canonical" href="[^"]*\/product\/signature-oversized-tee"/);
  });

  test("direct visit: the default colour never appears in the DOM", async ({ page }) => {
    await recordProductColours(page);
    await page.goto(`${PRODUCT}?colour=white`);
    await expect(page.getByText("Colour: White")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await seenColours(page)).toEqual({ labels: ["White"], images: ["white"] });
  });

  test("client navigation from a filtered shop card never shows the default colour", async ({
    page,
  }, testInfo) => {
    await recordProductColours(page);
    // Unfiltered shop first, so plain product links are prefetched (the risky case).
    await page.goto("/shop");
    await page.waitForLoadState("networkidle");
    const filters = await openFilters(page, testInfo);
    await filters.getByRole("checkbox", { name: "White", exact: true }).check();
    await expect(page).toHaveURL(/colour=white/);
    await closeFilters(page, testInfo);

    await page.evaluate(() => (window as unknown as { __resetSeen: () => void }).__resetSeen());
    await productCards(page)
      .filter({ hasText: "Signature Oversized Tee" })
      .getByRole("link")
      .click();
    await expect(page).toHaveURL(/\/product\/signature-oversized-tee\?colour=white$/);
    await expect(page.getByText("Colour: White")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await seenColours(page)).toEqual({ labels: ["White"], images: ["white"] });
  });

  test("a plain product URL still renders the default colour immediately", async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "HTTP-level check runs once");
    const html = await (await request.get(PRODUCT)).text();
    expect(html).toContain("tee-black-front");
    expect(html).toMatch(/Colour: <span[^>]*>Black/);
  });
});
