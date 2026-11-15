import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, loadAllImages, openFilters, test, waitForProductView } from "./fixtures";

/**
 * Review screenshots — only run when SCREENSHOT_DIR is set, e.g.
 *   SCREENSHOT_DIR=../jygs-clothing-screenshots/m2 npx playwright test screenshots
 */
const dir = process.env.SCREENSHOT_DIR;

test.describe("Review screenshots", () => {
  test.skip(!dir, "Set SCREENSHOT_DIR to capture review screenshots");

  test("capture key M2 views", async ({ page }, testInfo) => {
    mkdirSync(dir!, { recursive: true });
    const shot = async (name: string, fullPage = true) => {
      await loadAllImages(page);
      await page.screenshot({ path: join(dir!, `${testInfo.project.name}-${name}.png`), fullPage });
    };

    await page.goto("/shop");
    await shot("shop");

    await page.goto("/shop?colour=cherry,plum&fit=boxy");
    await shot("shop-filtered");

    await page.goto("/shop?q=hoodie");
    await shot("shop-empty-search", false);

    if (testInfo.project.name !== "desktop") {
      await page.goto("/shop");
      await openFilters(page, testInfo);
      await page.waitForTimeout(400);
      await shot("shop-filter-drawer", false);
    }

    await page.goto("/category/women");
    await shot("category-women");

    // Colour persistence: White filter on the shop → Signature card → product page in White.
    await page.goto("/shop?colour=white");
    await shot("shop-white-filter", false);
    await page
      .locator("main article")
      .filter({ hasText: "Signature Oversized Tee" })
      .getByRole("link")
      .click();
    await expect(page).toHaveURL(/\?colour=white$/);
    await waitForProductView(page);
    await expect(page.getByText("Colour: White")).toBeVisible();
    await shot("product-from-shop-white", false);

    await page.goto("/product/signature-oversized-tee");
    await waitForProductView(page);
    await shot("product");

    await page.getByRole("radio", { name: "White", exact: true }).check({ force: true });
    await expect(page.getByText("Colour: White")).toBeVisible();
    await loadAllImages(page);
    await page.getByText("Colour: White").evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(300);
    await page.screenshot({
      path: join(dir!, `${testInfo.project.name}-product-white-sizes.png`),
    });

    await page.getByRole("button", { name: "Size guide" }).click();
    await expect(page.getByText("Size Guide Coming Soon")).toBeVisible();
    await page.waitForTimeout(400);
    await shot("product-size-guide", false);
  });

  test("capture M3.3 bag views", async ({ page }, testInfo) => {
    mkdirSync(dir!, { recursive: true });
    const shot = async (name: string, fullPage = true) => {
      await loadAllImages(page);
      await page.screenshot({ path: join(dir!, `${testInfo.project.name}-${name}.png`), fullPage });
    };
    const v = (i: number) => `00000000-0000-4000-8006-${(100 + i).toString().padStart(12, "0")}`;
    const line = (variantId: string, quantity: number) => ({
      variantId,
      productId: "00000000-0000-4000-8004-000000000001",
      quantity,
      addedAt: "2026-11-14T09:00:00.000Z",
    });
    const seed = (lines: unknown[]) =>
      page.evaluate(
        (value) => localStorage.setItem("jygs:cart", value),
        JSON.stringify({
          v: 1,
          rev: 1,
          updatedAt: "2026-11-14T09:00:00.000Z",
          data: { lines, ops: [] },
        }),
      );

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
    await shot("bag-empty", false);

    await seed([line(v(3), 2), line(v(9), 1), line(v(5), 1)]);
    await page.reload();
    await expect(page.locator("[data-cart-line]")).toHaveCount(3);
    await shot("bag");

    // Adjusted (white M: 5 saved, 2 available), sold out (white XS) and unavailable lines.
    await seed([
      line(v(13), 5),
      line(v(11), 1),
      line("00000000-0000-4000-8006-999999999999", 2),
      line(v(3), 1),
    ]);
    await page.reload();
    await expect(page.locator("[data-cart-line]")).toHaveCount(4);
    await shot("bag-availability");

    await page.getByRole("button", { name: "Clear bag" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.waitForTimeout(300);
    await shot("bag-clear-dialog", false);
    await page.keyboard.press("Escape");

    await page.evaluate(() => localStorage.setItem("jygs:cart", "{damaged"));
    await page.reload();
    await expect(page.locator('[data-storage-notice="recovered"]')).toBeVisible();
    await shot("bag-storage-warning", false);
  });

  test("capture M3.4 wishlist views", async ({ page }, testInfo) => {
    mkdirSync(dir!, { recursive: true });
    const shot = async (name: string, fullPage = true) => {
      await loadAllImages(page);
      await page.screenshot({ path: join(dir!, `${testInfo.project.name}-${name}.png`), fullPage });
    };
    const id = (ns: number, n: number) =>
      `00000000-0000-4000-8${ns.toString().padStart(3, "0")}-${n.toString().padStart(12, "0")}`;
    const seed = (items: { productId: string; colourId: string | null }[]) =>
      page.evaluate(
        (value) => localStorage.setItem("jygs:wishlist", value),
        JSON.stringify({
          v: 1,
          rev: 1,
          updatedAt: "2026-11-14T09:00:00.000Z",
          data: { items: items.map((i) => ({ ...i, addedAt: "2026-11-14T09:00:00.000Z" })) },
        }),
      );

    await page.goto("/wishlist");
    await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toBeVisible();
    await shot("wishlist-empty", false);

    // Hearts: Signature saved in Black (filled on the Black card; "other colour" on White).
    await seed([
      { productId: id(4, 1), colourId: id(2, 1) },
      { productId: id(4, 2), colourId: null },
      { productId: id(4, 8), colourId: id(2, 4) },
      { productId: id(4, 3), colourId: id(2, 3) },
    ]);
    await page.goto("/shop");
    await expect(page.locator('[data-wishlist-state="saved"]').first()).toBeVisible();
    await shot("shop-hearts", false);
    await page.goto("/shop?colour=white");
    await expect(page.locator('[data-wishlist-state="other-colour"]').first()).toBeVisible();
    await shot("shop-hearts-other-colour", false);

    await page.goto("/wishlist");
    await expect(page.locator("[data-wishlist-item]")).toHaveCount(4);
    await shot("wishlist");
  });
});
