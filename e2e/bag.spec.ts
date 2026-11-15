import type { Page } from "@playwright/test";

import {
  bagLink,
  blockStorage,
  CART_KEY,
  envelope,
  expect,
  expectNoHorizontalOverflow,
  gotoProduct,
  readRaw,
  readStored,
  seedStorage,
  test,
  WISHLIST_KEY,
} from "./fixtures";

/**
 * M3.2 — Add to Bag, header counts, localStorage persistence and storage warnings.
 * IDs follow the mock catalogue (`mockId`): product n=1 is the Signature Oversized Tee with
 * colours black, off-white, white × sizes XS–XL (variant n*100 + index).
 */
const PRODUCT = "/product/signature-oversized-tee";
const PRODUCT_ID = "00000000-0000-4000-8004-000000000001";
const variantId = (index: number) =>
  `00000000-0000-4000-8006-${(100 + index).toString().padStart(12, "0")}`;
const BLACK_M = variantId(3);
const BLACK_L = variantId(4);
const WHITE_M = variantId(13); // demo stock 2

type StoredCart = { v: number; data: { lines: { variantId: string; quantity: number }[] } };

const addButton = (page: Page) => page.getByRole("button", { name: "Add to Bag", exact: true });
const status = (page: Page) => page.locator("#add-to-bag-status");
const badge = (page: Page) => bagLink(page).locator("[data-count-badge]");

async function pick(page: Page, name: string) {
  await page.getByRole("radio", { name, exact: true }).check({ force: true });
}

async function storedLines(page: Page) {
  return (await readStored<StoredCart>(page, CART_KEY))?.data.lines ?? [];
}

test.describe("Add to Bag", () => {
  test("requires a size: shows an alert, focuses the sizes and stores nothing", async ({
    page,
  }) => {
    await gotoProduct(page, PRODUCT);
    await addButton(page).click();
    // (Next.js also renders a route-announcer alert, so target the size error itself.)
    const error = page.locator("#size-error");
    await expect(error).toHaveText("Please select a size.");
    await expect(error).toHaveAttribute("role", "alert");
    await expect(page.locator('input[name="size"]:focus')).toHaveCount(1);
    expect(await readRaw(page, CART_KEY)).toBeNull();
    await expect(badge(page)).toHaveCount(0);

    // Choosing a size clears the error.
    await pick(page, "M");
    await expect(page.getByText("Please select a size.")).toHaveCount(0);
  });

  test("adds a variant, confirms with a View Bag link and updates the header count", async ({
    page,
  }) => {
    await gotoProduct(page, PRODUCT);
    await expect(bagLink(page)).toHaveAccessibleName("Bag");
    const before = await bagLink(page).boundingBox();

    await pick(page, "M");
    await addButton(page).click();
    await expect(status(page)).toContainText("Added to bag (1 piece of this size in your bag).");
    await expect(status(page).getByRole("link", { name: "View Bag" })).toHaveAttribute(
      "href",
      "/cart",
    );
    await expect(badge(page)).toHaveText("1");
    await expect(bagLink(page)).toHaveAccessibleName("Bag, 1 item");
    expect(await storedLines(page)).toEqual([
      expect.objectContaining({ variantId: BLACK_M, productId: PRODUCT_ID, quantity: 1 }),
    ]);

    // Same variant again → quantity 2 on the same line.
    await addButton(page).click();
    await expect(status(page)).toContainText("2 pieces of this size");
    await expect(badge(page)).toHaveText("2");
    expect(await storedLines(page)).toHaveLength(1);

    // Different size and different colour → separate lines.
    await pick(page, "L");
    await addButton(page).click();
    await expect(badge(page)).toHaveText("3");
    await pick(page, "Off-White");
    await pick(page, "M");
    await addButton(page).click();
    await expect(badge(page)).toHaveText("4");
    const lines = await storedLines(page);
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.quantity).sort()).toEqual([1, 1, 2]);

    // The badge is absolutely positioned — the Bag button does not move.
    // (Compare x/size only: y follows page scroll on smaller screens.)
    const after = await bagLink(page).boundingBox();
    expect({ x: after?.x, w: after?.width, h: after?.height }).toEqual({
      x: before?.x,
      w: before?.width,
      h: before?.height,
    });
    await expectNoHorizontalOverflow(page);
  });

  test("is disabled while adding, so repeated clicks add only once", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    await pick(page, "M");

    // Hold the cart's cross-tab lock so the add stays pending until we release it.
    await page.evaluate(
      (key) =>
        new Promise<void>((acquired) => {
          void navigator.locks.request(key, () => {
            acquired();
            return new Promise<void>((release) => {
              (window as unknown as { __releaseCart: () => void }).__releaseCart = release;
            });
          });
        }),
      CART_KEY,
    );

    // Two clicks in the same task (faster than any re-render), then more while pending.
    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>("#add-to-bag-status")
        ?.previousElementSibling as HTMLButtonElement;
      button.click();
      button.click();
    });
    const adding = page.getByRole("button", { name: "Adding…" });
    await expect(adding).toBeDisabled();
    await adding.click({ force: true });
    await adding.dblclick({ force: true });
    await page.keyboard.press("Enter");
    await expect(adding).toBeDisabled();
    expect(await readRaw(page, CART_KEY)).toBeNull(); // nothing written while pending

    await page.evaluate(() => (window as unknown as { __releaseCart: () => void }).__releaseCart());

    // Completed: enabled again (limit not reached), exactly one piece stored and counted.
    await expect(addButton(page)).toBeEnabled();
    await expect(status(page)).toContainText("Added to bag (1 piece of this size in your bag).");
    await expect(badge(page)).toHaveText("1");
    await expect(bagLink(page)).toHaveAccessibleName("Bag, 1 item");
    expect(await storedLines(page)).toEqual([
      expect.objectContaining({ variantId: BLACK_M, quantity: 1 }),
    ]);

    // A normal click afterwards still works.
    await addButton(page).click();
    await expect(badge(page)).toHaveText("2");
    expect((await storedLines(page))[0].quantity).toBe(2);
  });

  test("count persists after a refresh and on other pages", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    await pick(page, "M");
    await addButton(page).click();
    await expect(badge(page)).toHaveText("1");

    await page.reload();
    await expect(badge(page)).toHaveText("1");
    await page.goto("/shop");
    await expect(badge(page)).toHaveText("1");
  });

  test("stops at the demo-stock limit with an explanation", async ({ page }) => {
    await gotoProduct(page, `${PRODUCT}?colour=white`);
    await pick(page, "M — low stock");
    await addButton(page).click();
    await expect(status(page)).toContainText("1 piece");
    await addButton(page).click();
    await expect(status(page)).toContainText("2 pieces");

    const maxed = page.getByRole("button", { name: "Maximum in Bag" });
    await expect(maxed).toBeDisabled();
    expect((await storedLines(page))[0]).toMatchObject({ variantId: WHITE_M, quantity: 2 });

    await page.reload();
    await pick(page, "M — low stock");
    await expect(maxed).toBeDisabled();
    await expect(status(page)).toContainText(
      "You have the maximum available (2) in this size in your bag (demo stock).",
    );
    await expect(status(page).getByRole("link", { name: "View Bag" })).toBeVisible();
  });

  test("explains reduced stock without changing the stored bag", async ({ page }) => {
    await seedStorage(page, {
      [CART_KEY]: envelope({
        lines: [
          {
            variantId: WHITE_M,
            productId: PRODUCT_ID,
            quantity: 5,
            addedAt: "2026-11-14T09:00:00.000Z",
          },
        ],
        ops: [],
      }),
    });
    await gotoProduct(page, `${PRODUCT}?colour=white`);
    await pick(page, "M — low stock");
    await expect(status(page)).toContainText(
      "Your bag already has 5 — only 2 available in this size (demo stock).",
    );
    await expect(status(page).getByRole("link", { name: "Review your bag" })).toHaveAttribute(
      "href",
      "/cart",
    );
    await expect(page.getByRole("button", { name: "Maximum in Bag" })).toBeDisabled();
    expect((await storedLines(page))[0].quantity).toBe(5);
  });

  test("shows 9+ for large counts with the full number for screen readers", async ({ page }) => {
    const line = (variant: string, quantity: number) => ({
      variantId: variant,
      productId: PRODUCT_ID,
      quantity,
      addedAt: "2026-11-14T09:00:00.000Z",
    });
    await seedStorage(page, {
      [CART_KEY]: envelope({ lines: [line(BLACK_M, 6), line(BLACK_L, 6)], ops: [] }),
    });
    await page.goto("/");
    await expect(badge(page)).toHaveText("9+");
    await expect(bagLink(page)).toHaveAccessibleName("Bag, 12 items");
    await expectNoHorizontalOverflow(page);
  });

  test("updates the count in another open tab", async ({ page, context }) => {
    const other = await context.newPage();
    await other.goto("/shop");
    await expect(bagLink(other)).toHaveAccessibleName("Bag");

    await gotoProduct(page, PRODUCT);
    await pick(page, "M");
    await addButton(page).click();
    await expect(badge(page)).toHaveText("1");
    await expect(badge(other)).toHaveText("1");
    await other.close();
  });
});

test.describe("Wishlist count", () => {
  const item = (n: number) => ({
    productId: `00000000-0000-4000-8004-${n.toString().padStart(12, "0")}`,
    colourId: null,
    addedAt: "2026-11-14T09:00:00.000Z",
  });

  test("shows in the header (tablet/desktop) or the menu (mobile)", async ({ page }, testInfo) => {
    await seedStorage(page, { [WISHLIST_KEY]: envelope({ items: [item(1), item(2)] }) });
    await page.goto("/");
    const header = page.getByRole("banner");

    if (testInfo.project.name === "mobile") {
      // Decision A: no wishlist icon in the phone header; the count is in the menu.
      await expect(header.getByRole("link", { name: /^Wishlist/ })).toBeHidden();
      await header.getByRole("button", { name: "Open menu" }).click();
      const menuLink = page
        .getByRole("navigation", { name: "Mobile" })
        .getByRole("link", { name: "Wishlist, 2 items" });
      await expect(menuLink).toBeVisible();
      await expect(menuLink.locator("[data-count-badge]")).toHaveText("2");
    } else {
      const link = header.getByRole("link", { name: "Wishlist, 2 items" });
      await expect(link).toBeVisible();
      await expect(link.locator("[data-count-badge]")).toHaveText("2");
    }
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Storage warnings", () => {
  test("blocked storage: warns, still adds for this visit, forgets after refresh", async ({
    page,
  }) => {
    await blockStorage(page);
    await gotoProduct(page, PRODUCT);
    const notice = page.locator('[data-storage-notice="memory-only"]');
    await expect(notice).toHaveText(
      "Your bag can't be saved in this browser and will be cleared when you refresh.",
    );
    await pick(page, "M");
    await addButton(page).click();
    await expect(badge(page)).toHaveText("1");

    await page.reload();
    await expect(page.locator("[data-product-view][data-ready]")).toHaveCount(1);
    await expect(notice).toBeVisible();
    await expect(badge(page)).toHaveCount(0);
  });

  test("damaged saved bag: resets, keeps a backup copy and says so", async ({ page }) => {
    const damaged = "{not valid json";
    await seedStorage(page, { [CART_KEY]: damaged });
    await gotoProduct(page, PRODUCT);
    await expect(page.locator('[data-storage-notice="recovered"]')).toContainText(
      "A copy of the damaged data was kept.",
    );
    const backups = await page.evaluate(
      (prefix) =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith(prefix))
          .map((k) => localStorage.getItem(k)),
      `${CART_KEY}:backup:`,
    );
    expect(backups).toEqual([damaged]);

    await pick(page, "M");
    await addButton(page).click();
    await expect(badge(page)).toHaveText("1");
    expect(await storedLines(page)).toHaveLength(1);
  });

  test("bag from a different version: warns and never overwrites it", async ({ page }) => {
    const foreign = envelope({ something: "from the future" }, 99);
    await seedStorage(page, { [CART_KEY]: foreign });
    await gotoProduct(page, PRODUCT);
    await expect(page.locator('[data-storage-notice="foreign-version"]')).toContainText(
      "It has not been deleted.",
    );
    await pick(page, "M");
    await addButton(page).click();
    await expect(badge(page)).toHaveText("1");
    expect(await readRaw(page, CART_KEY)).toBe(foreign);
  });

  test("no warning when saving normally", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    await expect(addButton(page)).toBeEnabled();
    await expect(page.locator("[data-storage-notice]")).toHaveCount(0);
  });
});

test.describe("Add to Bag — final review fixes", () => {
  /** The single Add to Bag button, whatever its current label. */
  const bagButton = (page: Page) =>
    page.getByRole("button", { name: /^(Add to Bag|Adding…|Maximum in Bag)$/ });

  test("keyboard focus stays on the button while adding and at the limit; extra presses do nothing", async ({
    page,
  }) => {
    await gotoProduct(page, `${PRODUCT}?colour=white`);
    await pick(page, "M — low stock"); // demo stock 2
    const button = bagButton(page);
    await button.focus();

    await page.keyboard.press("Enter");
    await expect(status(page)).toContainText("1 piece");
    await expect(button).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(status(page)).toContainText("2 pieces");
    await expect(button).toHaveText("Maximum in Bag");
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(button).toBeFocused(); // not lost at the limit

    await page.keyboard.press("Enter"); // ignored at the limit
    await page.keyboard.press("Space");
    await expect(status(page)).toContainText("2 pieces");
    expect((await storedLines(page))[0]).toMatchObject({ variantId: WHITE_M, quantity: 2 });
    await expect(badge(page)).toHaveText("2");
  });

  test("keyboard focus stays on the button while an add is pending", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    await pick(page, "M");
    await page.evaluate(
      (key) =>
        new Promise<void>((acquired) => {
          void navigator.locks.request(key, () => {
            acquired();
            return new Promise<void>((release) => {
              (window as unknown as { __release: () => void }).__release = release;
            });
          });
        }),
      CART_KEY,
    );
    const button = bagButton(page);
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveText("Adding…");
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(button).toBeFocused();
    await page.keyboard.press("Enter"); // ignored while pending

    await page.evaluate(() => (window as unknown as { __release: () => void }).__release());
    await expect(status(page)).toContainText("Added to bag (1 piece of this size in your bag).");
    await expect(button).toHaveText("Add to Bag");
    await expect(button).toBeFocused();
    expect((await storedLines(page))[0].quantity).toBe(1);
  });

  test("blocked storage: the success message says 'for this visit only'", async ({ page }) => {
    await blockStorage(page);
    await gotoProduct(page, PRODUCT);
    await pick(page, "M");
    await addButton(page).click();
    await expect(status(page)).toContainText(
      "Added to bag (1 piece of this size in your bag) for this visit only — it couldn't be saved in this browser.",
    );
    await expect(status(page).getByRole("link", { name: "View Bag" })).toBeVisible();
  });

  test("a write that fails mid-visit: the success message never implies it was saved", async ({
    page,
  }) => {
    await gotoProduct(page, PRODUCT);
    await pick(page, "M");
    await page.evaluate((key) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, value: string) {
        if (k === key) throw new DOMException("Quota exceeded", "QuotaExceededError");
        return original.call(this, k, value);
      };
    }, CART_KEY);
    await addButton(page).click();
    await expect(status(page)).toContainText("for this visit only — it couldn't be saved");
    await expect(status(page)).not.toContainText("your bag).");
    expect(await readRaw(page, CART_KEY)).toBeNull();
    await expect(page.locator('[data-storage-notice="memory-only"]')).toBeVisible();
  });

  test("a normal (persistent) add keeps the plain success message", async ({ page }) => {
    await gotoProduct(page, PRODUCT);
    await pick(page, "M");
    await addButton(page).click();
    await expect(status(page)).toContainText("Added to bag (1 piece of this size in your bag).");
    await expect(status(page)).not.toContainText("for this visit only");
  });
});
