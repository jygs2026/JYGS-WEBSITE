import { expect, expectNoHorizontalOverflow, isDesktop, loadAllImages, test } from "./fixtures";

test.describe("Homepage (M1 regression)", () => {
  test("renders every section with demo-labelled products", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Essentials Redefined" }),
    ).toBeVisible();
    for (const name of ["Find your fit", "New Arrivals", "Best Sellers", "@jygs.clothing"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    const cards = page.locator("main article");
    await expect(cards).toHaveCount(8);
    for (const card of await cards.all()) {
      await expect(card).toContainText("Demo product");
      await expect(card).toContainText("Demo price");
    }
    await loadAllImages(page);
    await expectNoHorizontalOverflow(page);
  });

  test("hero 'Shop Collection' opens the real shop page", async ({ page }) => {
    await page.goto("/");
    await page
      .locator('section[aria-labelledby="hero-heading"]')
      .getByRole("link", { name: "Shop Collection" })
      .click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(page.getByRole("heading", { level: 1, name: "Shop All" })).toBeVisible();
  });

  test("main navigation reaches category and collection listings", async ({ page }, testInfo) => {
    const targets = [
      ["Men", "/category/men"],
      ["Women", "/category/women"],
      ["Unisex", "/category/unisex"],
      ["New Arrivals", "/collections/new-arrivals"],
      ["Best Sellers", "/collections/best-sellers"],
    ] as const;
    for (const [label, path] of targets) {
      await page.goto("/");
      if (isDesktop(testInfo)) {
        await page
          .getByRole("navigation", { name: "Main" })
          .getByRole("link", { name: label, exact: true })
          .click();
      } else {
        await page.getByRole("button", { name: "Open menu" }).click();
        await page.getByRole("dialog").getByRole("link", { name: label, exact: true }).click();
      }
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
      await expect(page.locator("main article").first()).toBeVisible();
    }
  });

  test("product cards link to product pages", async ({ page }) => {
    await page.goto("/");
    const first = page.locator("main article").first();
    const name = (await first.locator("h3").textContent())?.trim() ?? "";
    await first.getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  });
});
