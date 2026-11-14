import {
  closeFilters,
  expect,
  gotoProduct,
  openFilters,
  productCards,
  test,
  waitForProductView,
} from "./fixtures";

const PRODUCT = "/product/signature-oversized-tee";
const gallerySlide = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("region", { name: "Signature Oversized Tee images" }).getByRole("group", { name });

test.describe("Colour persists from shop to product page", () => {
  test("shop colour filter → card colourway → product page opens on that colour", async ({
    page,
  }, testInfo) => {
    await page.goto("/shop");
    const filters = await openFilters(page, testInfo);
    await filters.getByRole("checkbox", { name: "White", exact: true }).check();
    await expect(page).toHaveURL(/colour=white/);
    await closeFilters(page, testInfo);

    const card = productCards(page).filter({ hasText: "Signature Oversized Tee" });
    await expect(card.locator("img").first()).toHaveAttribute("src", /tee-white-front/);
    await expect(card.getByRole("link")).toHaveAttribute(
      "href",
      "/product/signature-oversized-tee?colour=white",
    );

    await card.getByRole("link").click();
    await expect(page).toHaveURL(/\/product\/signature-oversized-tee\?colour=white$/);
    await waitForProductView(page);

    // Colour, front + back images, and White's own size availability.
    await expect(page.getByText("Colour: White")).toBeVisible();
    await expect(page.getByRole("radio", { name: "White", exact: true })).toBeChecked();
    await expect(gallerySlide(page, "1 of 2: Front").locator("img")).toHaveAttribute(
      "src",
      /tee-white-front/,
    );
    await expect(gallerySlide(page, "2 of 2: Back").locator("img")).toHaveAttribute(
      "src",
      /tee-white-back-stack/,
    );
    await expect(page.getByRole("radio", { name: "XS — sold out", exact: true })).toBeDisabled();
    await expect(page.getByRole("radio", { name: "S — sold out", exact: true })).toBeDisabled();
    await page.getByRole("radio", { name: "M — low stock", exact: true }).check({ force: true });
    await expect(page.getByText("Low stock in M (demo stock).")).toBeVisible();
  });

  test("direct link with ?colour= opens that colourway", async ({ page }) => {
    await gotoProduct(page, `${PRODUCT}?colour=off-white`);
    await expect(page.getByText("Colour: Off-White")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Off-White" })).toBeChecked();
    await expect(gallerySlide(page, "1 of 2: Front").locator("img")).toHaveAttribute(
      "src",
      /tee-off-white-front/,
    );
    // Off-White has full stock — no size is disabled.
    for (const size of ["XS", "S", "M", "L", "XL"]) {
      await expect(page.getByRole("radio", { name: size, exact: true })).toBeEnabled();
    }
  });

  test("colour parameter is case-insensitive", async ({ page }) => {
    await gotoProduct(page, `${PRODUCT}?colour=WHITE`);
    await expect(page.getByText("Colour: White")).toBeVisible();
  });

  for (const bad of ["purple", "plum", "", "%3Cscript%3E"]) {
    test(`invalid colour "${bad}" falls back to the default colour`, async ({ page }) => {
      await gotoProduct(page, `${PRODUCT}?colour=${bad}`);
      await expect(
        page.getByRole("heading", { level: 1, name: "Signature Oversized Tee" }),
      ).toBeVisible();
      await expect(page.getByText("Colour: Black")).toBeVisible();
      await expect(gallerySlide(page, "1 of 2: Front").locator("img")).toHaveAttribute(
        "src",
        /tee-black-front/,
      );
    });
  }

  test("direct links without ?colour= still open the default colour", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    await expect(page.getByText("Colour: Black")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${PRODUCT}$`));
  });

  test("changing colour on the product page updates the shareable URL", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    await page.getByRole("radio", { name: "White", exact: true }).check({ force: true });
    await expect(page).toHaveURL(/\?colour=white$/);
    await page.reload();
    await waitForProductView(page);
    await expect(page.getByText("Colour: White")).toBeVisible();
    // Back to the default colour → clean canonical URL.
    await page.getByRole("radio", { name: "Black" }).check({ force: true });
    await expect(page).toHaveURL(new RegExp(`${PRODUCT}$`));
  });

  test("unfiltered shop and homepage cards keep plain product links", async ({ page }) => {
    await page.goto("/shop");
    await expect(productCards(page).first().getByRole("link")).toHaveAttribute(
      "href",
      /^\/product\/[a-z0-9-]+$/,
    );
    await page.goto("/");
    for (const link of await page.locator("main article a").all()) {
      await expect(link).toHaveAttribute("href", /^\/product\/[a-z0-9-]+$/);
    }
  });
});
