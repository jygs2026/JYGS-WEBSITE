import { expect, expectNoHorizontalOverflow, gotoProduct, loadAllImages, test } from "./fixtures";

const PRODUCT = "/product/signature-oversized-tee";

test.describe("Product detail page", () => {
  test("shows product information, brand specs and breadcrumbs", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    await expect(
      page.getByRole("heading", { level: 1, name: "Signature Oversized Tee" }),
    ).toBeVisible();
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs).toContainText("Home");
    await expect(crumbs).toContainText("Unisex");
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText("Signature Oversized Tee");

    const specs = page.getByRole("list", { name: "Key details" });
    await expect(specs).toContainText("100% Compact Cotton");
    await expect(specs).toContainText("240 GSM");
    await expect(specs).toContainText("Oversized fit");
    await expect(page.getByText("Demo price").first()).toBeVisible();

    await page.getByText("Fabric & weight").click();
    await expect(page.getByText("100% Compact Cotton").last()).toBeVisible();
    await page.getByText("Print", { exact: true }).click();
    await expect(page.getByText("Minimal JYGS chest logo")).toBeVisible();
    await expect(page.getByText("Strong JYGS back graphic")).toBeVisible();

    await loadAllImages(page);
    await expectNoHorizontalOverflow(page);
  });

  test("gallery shows front and back views", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    const gallery = page.getByRole("region", { name: "Signature Oversized Tee images" });
    await expect(gallery.getByRole("group", { name: "1 of 2: Front" })).toBeVisible();
    await gallery.getByRole("button", { name: "Show back view" }).click();
    await expect(gallery.getByRole("button", { name: "Show back view" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(
      gallery.getByRole("group", { name: "2 of 2: Back" }).locator("img"),
    ).toHaveAttribute("src", /black-back-stack/);
  });

  test("colour selection switches the artwork", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    await expect(page.getByText("Colour: Black")).toBeVisible();
    await page.getByRole("radio", { name: "Off-White" }).check({ force: true });
    await expect(page.getByText("Colour: Off-White")).toBeVisible();
    await expect(page.getByRole("group", { name: "1 of 2: Front" }).locator("img")).toHaveAttribute(
      "src",
      /off-white-front/,
    );
  });

  test("sizes are XS–XL and sold-out sizes cannot be selected", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    const sizes = page.getByRole("radio", { name: /^(XS|S|M|L|XL)\b/ });
    await expect(sizes).toHaveCount(5);
    await expect(page.getByText("XXL")).toHaveCount(0);

    // Black: XS available. Pick it, then switch to White where XS is sold out.
    await page.getByRole("radio", { name: "XS", exact: true }).check({ force: true });
    await expect(page.getByText("Size: XS")).toBeVisible();
    await page.getByRole("radio", { name: "White", exact: true }).check({ force: true });
    await expect(page.getByText("Size: Select a size")).toBeVisible();
    await expect(page.getByRole("radio", { name: "XS — sold out", exact: true })).toBeDisabled();
    await expect(page.getByRole("radio", { name: "S — sold out", exact: true })).toBeDisabled();

    await page.getByRole("radio", { name: "M — low stock", exact: true }).check({ force: true });
    await expect(page.getByText("Low stock in M (demo stock).")).toBeVisible();
  });

  test("size guide says 'coming soon' and shows no measurements", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    await page.getByRole("button", { name: "Size guide" }).click();
    const guide = page.getByRole("dialog", { name: "Size guide" });
    await expect(guide.getByText("Size Guide Coming Soon")).toBeVisible();
    await expect(guide).not.toContainText(/\b(cm|inch|inches|chest|shoulder)\b/i);
    await page.keyboard.press("Escape");
    await expect(guide).toBeHidden();
  });

  test("Add to Bag is enabled, and no payment is taken (M3.2)", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    const button = page.getByRole("button", { name: "Add to Bag", exact: true });
    await expect(button).toBeEnabled();
    await expect(
      page.getByText("Checkout isn’t available yet. No payment is taken on this site."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /coming soon/i })).toHaveCount(0);
  });

  test("colour can be changed with the keyboard", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    await page.getByRole("radio", { name: "Black" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Colour: Off-White")).toBeVisible();
  });

  test("related products link to other product pages", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    const related = page.locator("#related article");
    await expect(related).toHaveCount(4);
    const name = (await related.first().locator("h3").textContent())?.trim() ?? "";
    expect(name).not.toBe("Signature Oversized Tee");
    await related.first().getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  });
});
