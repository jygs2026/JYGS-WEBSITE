import {
  cardPrices,
  closeFilters,
  expect,
  expectNoHorizontalOverflow,
  isDesktop,
  loadAllImages,
  openFilters,
  productCards,
  test,
} from "./fixtures";

const count = (page: import("@playwright/test").Page) => page.getByRole("status").first();

test.describe("Shop / product listing", () => {
  test("lists all published tees with breadcrumbs and no overflow", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByRole("heading", { level: 1, name: "Shop All" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Home");
    await expect(count(page)).toHaveText("10 products");
    await expect(productCards(page)).toHaveCount(10);
    for (const card of await productCards(page).all()) {
      await expect(card).toContainText(/(Oversized|Boxy) fit · (240|250|260) GSM/);
      await expect(card).toContainText("Demo price");
    }
    await loadAllImages(page);
    await expectNoHorizontalOverflow(page);
  });

  test("filters by colour, shows chips, and removes them", async ({ page }, testInfo) => {
    await page.goto("/shop");
    const filters = await openFilters(page, testInfo);
    await filters.getByRole("checkbox", { name: "Cherry" }).check();
    await expect(page).toHaveURL(/colour=cherry/);
    await expect(count(page)).toHaveText("2 products");
    await closeFilters(page, testInfo);

    // Cards switch to the filtered colourway's artwork.
    await expect(productCards(page).first().locator("img").first()).toHaveAttribute(
      "src",
      /cherry-front/,
    );
    const chip = page.getByRole("button", { name: "Remove filter: Cherry" });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(count(page)).toHaveText("10 products");
    await expect(page).toHaveURL(/\/shop$/);
  });

  test("combines fit + weight filters (AND across groups)", async ({ page }, testInfo) => {
    await page.goto("/shop");
    const filters = await openFilters(page, testInfo);
    await filters.getByRole("checkbox", { name: "Boxy fit" }).check();
    await expect(page).toHaveURL(/fit=boxy/);
    await filters.getByRole("checkbox", { name: "250 GSM" }).check();
    await expect(page).toHaveURL(/gsm=250/);
    await closeFilters(page, testInfo);
    await expect(count(page)).toHaveText("2 products");
    for (const card of await productCards(page).all()) {
      await expect(card).toContainText("Boxy fit · 250 GSM");
    }
  });

  test("size + colour respect per-colour stock and show an empty state", async ({ page }) => {
    await page.goto("/shop?colour=white&size=xs");
    await expect(page.getByText("No tees match")).toBeVisible();
    await page.getByRole("button", { name: "Clear all filters" }).click();
    await expect(count(page)).toHaveText("10 products");
  });

  test("'In stock only' hides the sold-out tee", async ({ page }, testInfo) => {
    await page.goto("/shop");
    await expect(page.getByText("Pine Monogram Oversized Tee")).toBeVisible();
    const filters = await openFilters(page, testInfo);
    await filters.getByRole("checkbox", { name: "In stock only" }).check();
    await expect(count(page)).toHaveText("9 products");
    await closeFilters(page, testInfo);
    await expect(page.getByText("Pine Monogram Oversized Tee")).toBeHidden();
  });

  test("offers sizes XS–XL only", async ({ page }, testInfo) => {
    await page.goto("/shop");
    const filters = await openFilters(page, testInfo);
    const sizeGroup = filters.getByRole("group", { name: "Size" });
    await expect(sizeGroup.getByRole("checkbox")).toHaveCount(5);
    for (const size of ["XS", "S", "M", "L", "XL"]) {
      await expect(sizeGroup.getByRole("checkbox", { name: size, exact: true })).toBeAttached();
    }
    await expect(filters.getByText("XXL")).toHaveCount(0);
  });

  test("sorts by price in both directions", async ({ page }) => {
    await page.goto("/shop");
    await page.getByLabel("Sort by").selectOption("price-asc");
    await expect(page).toHaveURL(/sort=price-asc/);
    const asc = await cardPrices(page);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    await page.getByLabel("Sort by").selectOption("price-desc");
    await expect(page).toHaveURL(/sort=price-desc/);
    const desc = await cardPrices(page);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  test("searches product names via ?q=", async ({ page }) => {
    await page.goto("/shop");
    const search = page.getByRole("searchbox", { name: "Search products by name" });
    await search.fill("orbit");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=orbit/);
    await expect(productCards(page)).toHaveCount(2);
    await expect(page.getByRole("button", { name: /Remove filter: Search/ })).toBeVisible();

    await search.fill("hoodie");
    await search.press("Enter");
    await expect(page.getByText("No tees match")).toBeVisible();
    await expect(page.getByText("Nothing found for “hoodie”")).toBeVisible();

    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(count(page)).toHaveText("10 products");
  });

  test("shared filter URLs restore the same state", async ({ page }, testInfo) => {
    await page.goto("/shop?fit=boxy&sort=price-desc");
    await expect(page.getByLabel("Sort by")).toHaveValue("price-desc");
    await expect(count(page)).toHaveText("5 products");
    for (const card of await productCards(page).all()) await expect(card).toContainText("Boxy fit");
    if (isDesktop(testInfo)) {
      await expect(
        page
          .getByRole("complementary", { name: "Product filters" })
          .getByRole("checkbox", { name: "Boxy fit" }),
      ).toBeChecked();
    } else {
      await expect(page.getByRole("button", { name: "Filters (1)" })).toBeVisible();
    }
  });

  test("ignores invalid URL values", async ({ page }) => {
    await page.goto("/shop?size=xxl&colour=red&fit=regular&sort=nope&gsm=180");
    await expect(count(page)).toHaveText("10 products");
    await expect(page.getByLabel("Sort by")).toHaveValue("featured");
  });

  test("category pages are scoped and hide the category filter", async ({ page }, testInfo) => {
    await page.goto("/category/women");
    await expect(page.getByRole("heading", { level: 1, name: "Women" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Shop");
    for (const card of await productCards(page).all()) await expect(card).toContainText("Women ·");
    const filters = await openFilters(page, testInfo);
    await expect(filters.getByText("Category", { exact: true })).toHaveCount(0);
  });

  test("New Arrivals defaults to newest first", async ({ page }) => {
    await page.goto("/collections/new-arrivals");
    await expect(page.getByRole("heading", { level: 1, name: "New Arrivals" })).toBeVisible();
    await expect(page.getByLabel("Sort by")).toHaveValue("newest");
    await expect(productCards(page)).toHaveCount(4);
    await expect(productCards(page).first()).toContainText("Signature Oversized Tee");
  });
});
