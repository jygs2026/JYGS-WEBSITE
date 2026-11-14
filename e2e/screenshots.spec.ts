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
});
