import type { Page } from "@playwright/test";

import { expect, expectNoHorizontalOverflow, gotoProduct, test } from "./fixtures";

/**
 * Layout regression for the product options panel: nothing may be clipped or overflow, and the
 * "Size guide" link must sit on the same row as the "Size:" label, clear of the size buttons.
 */
const WIDTHS: Record<string, { width: number; height: number }[]> = {
  desktop: [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ],
  tablet: [{ width: 820, height: 1180 }],
  mobile: [{ width: 393, height: 852 }],
};

async function box(page: Page, selector: ReturnType<Page["locator"]>) {
  const b = await selector.boundingBox();
  expect(b, "element should be rendered").not.toBeNull();
  return b!;
}

test.describe("Product options layout", () => {
  test("size row, size guide and bag button fit at every width", async ({ page }, testInfo) => {
    for (const viewport of WIDTHS[testInfo.project.name] ?? []) {
      await page.setViewportSize(viewport);
      await gotoProduct(page, "/product/signature-oversized-tee?colour=white");
      await expectNoHorizontalOverflow(page);

      const view = page.locator("[data-product-view][data-ready]");
      const infoColumn = view.locator(":scope > div").nth(1);
      const sizeGroup = page.getByRole("group", { name: /^Size:/ });
      const legend = sizeGroup.locator("legend");
      const guide = page.getByRole("button", { name: "Size guide" });
      const xl = sizeGroup.locator("label").filter({ hasText: /^XL/ });
      const bag = page.getByRole("button", { name: "Add to Bag", exact: true });

      const column = await box(page, infoColumn);
      const columnRight = column.x + column.width;
      const label = `${viewport.width}px`;

      for (const [name, el] of [
        ["XL size", xl],
        ["Size guide", guide],
        ["Add to Bag", bag],
      ] as const) {
        const b = await box(page, el);
        expect(b.x + b.width, `${name} right edge within column (${label})`).toBeLessThanOrEqual(
          columnRight + 0.5,
        );
        expect(b.x + b.width, `${name} within viewport (${label})`).toBeLessThanOrEqual(
          viewport.width,
        );
        expect(b.x, `${name} left edge within column (${label})`).toBeGreaterThanOrEqual(
          column.x - 0.5,
        );
      }

      // Size guide is level with the "Size:" label and clear of the size buttons.
      const legendBox = await box(page, legend);
      const guideBox = await box(page, guide);
      const xlBox = await box(page, xl);
      const legendCentre = legendBox.y + legendBox.height / 2;
      const guideCentre = guideBox.y + guideBox.height / 2;
      expect(
        Math.abs(legendCentre - guideCentre),
        `guide aligned with label (${label})`,
      ).toBeLessThan(4);
      expect(
        xlBox.y - (guideBox.y + guideBox.height),
        `gap above sizes (${label})`,
      ).toBeGreaterThanOrEqual(8);

      // All five sizes visible on one row, none clipped.
      const sizes = sizeGroup.locator("label");
      await expect(sizes).toHaveCount(5);
      const first = await box(page, sizes.first());
      expect(Math.round(xlBox.y), `sizes on one row (${label})`).toBe(Math.round(first.y));

      // Size guide still opens.
      await guide.click();
      await expect(page.getByText("Size Guide Coming Soon")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByText("Size Guide Coming Soon")).toBeHidden();
    }
  });
});
