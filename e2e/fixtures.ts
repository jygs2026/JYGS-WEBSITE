import { test as base, expect, type Locator, type Page, type TestInfo } from "@playwright/test";

/**
 * Every test fails if the page logs a console error or throws an uncaught exception.
 * (Tests that intentionally hit 404s use the `request` fixture instead of a page.)
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(String(e)));
      await use(errors);
      expect(errors, "browser console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const isDesktop = (testInfo: TestInfo) => testInfo.project.name === "desktop";

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal overflow (px)").toBeLessThanOrEqual(0);
}

/** Scrolls through the page so lazy images load, then waits until every visible image decoded. */
export async function loadAllImages(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() =>
    [...document.images]
      .filter((img) => getComputedStyle(img).display !== "none")
      .every((img) => img.complete && img.naturalWidth > 0),
  );
}

/** The filter controls: the sidebar on desktop, the drawer (opened on demand) elsewhere. */
export async function openFilters(page: Page, testInfo: TestInfo): Promise<Locator> {
  if (isDesktop(testInfo)) return page.getByRole("complementary", { name: "Product filters" });
  await page.getByRole("button", { name: /^Filters/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filters" });
  await expect(drawer).toBeVisible();
  return drawer;
}

/** Closes the mobile/tablet filter drawer (no-op on desktop). */
export async function closeFilters(page: Page, testInfo: TestInfo) {
  if (isDesktop(testInfo)) return;
  await page.getByRole("button", { name: /^Show \d+ results?$/ }).click();
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeHidden();
}

export const productCards = (page: Page) => page.locator("main article");

/**
 * Waits until the product page's interactive view is live (hydrated from the browser URL).
 * The static shell shows the same colour, but its controls are replaced on hydration.
 */
export async function waitForProductView(page: Page) {
  await expect(page.locator("[data-product-view][data-ready]")).toHaveCount(1);
}

/** Opens a product page and waits until it is interactive. */
export async function gotoProduct(page: Page, url: string) {
  await page.goto(url);
  await waitForProductView(page);
}

// --- M3 storage helpers ------------------------------------------------------------------------

export const CART_KEY = "jygs:cart";
export const WISHLIST_KEY = "jygs:wishlist";

/** Reads a stored envelope (`{ v, rev, updatedAt, data }`) from localStorage, or null. */
export async function readStored<T = unknown>(page: Page, key: string): Promise<T | null> {
  return page.evaluate((k) => {
    const raw = window.localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, key);
}

/** Raw stored string for a key, or null. */
export async function readRaw(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => window.localStorage.getItem(k), key);
}

/** Seeds localStorage before any page script runs (applies to every navigation in the test). */
export async function seedStorage(page: Page, values: Record<string, string>) {
  await page.addInitScript((entries) => {
    if (sessionStorage.getItem("__seeded__")) return; // seed once per tab, keep later changes
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
    sessionStorage.setItem("__seeded__", "1");
  }, values);
}

/** A version-1 storage envelope string. */
export const envelope = (data: unknown, v = 1) =>
  JSON.stringify({ v, rev: 1, updatedAt: "2026-11-14T09:00:00.000Z", data });

/** Makes localStorage unusable (as in some private modes / blocked storage). */
export async function blockStorage(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
  });
}

/** The header Bag link (all screen sizes). */
export const bagLink = (page: Page) =>
  page.getByRole("banner").getByRole("link", { name: /^Bag(, \d+ items?)?$/ });

/** Parses the displayed prices (₹1,499 → 1499) of all product cards, in order. */
export async function cardPrices(page: Page): Promise<number[]> {
  // The current price is the first <span> of the price line (the "Demo price" tag comes later).
  const texts = await productCards(page).locator("p > span:first-child").allTextContents();
  return texts.map((t) => Number(t.replace(/[^\d]/g, "")));
}
