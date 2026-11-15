import type { Locator, Page } from "@playwright/test";

import {
  bagLink,
  blockStorage,
  CART_KEY,
  envelope,
  expect,
  expectNoHorizontalOverflow,
  gotoProduct,
  isDesktop,
  readRaw,
  readStored,
  seedStorage,
  test,
  waitForProductView,
} from "./fixtures";

/**
 * Next.js keeps the previous route mounted (hidden) after client-side navigation, so selectors
 * that also exist on the product page must match visible elements only.
 */
const visibleNotice = (page: Page, status: string) =>
  page.locator(`[data-storage-notice="${status}"]`).filter({ visible: true });

/**
 * M3.3 — the bag page. IDs follow the mock catalogue: product n=1 is the Signature Oversized Tee
 * (₹1,499 demo) in black / off-white / white × XS–XL; variant id = n*100 + index.
 * Demo stock: black XS6 S12 M18 L15 XL9; white XS0 S0 M2.
 */
const SIGNATURE = "00000000-0000-4000-8004-000000000001";
const variantId = (index: number) =>
  `00000000-0000-4000-8006-${(100 + index).toString().padStart(12, "0")}`;
const V = {
  blackS: variantId(2),
  blackM: variantId(3),
  blackL: variantId(4),
  blackXL: variantId(5),
  offWhiteL: variantId(9),
  whiteXS: variantId(11), // sold out
  whiteM: variantId(13), // demo stock 2
};
const MISSING_VARIANT = "00000000-0000-4000-8006-999999999999";
const MISSING_PRODUCT = "00000000-0000-4000-8004-999999999999";
const AT = "2026-11-14T09:00:00.000Z";

type Line = { variantId: string; productId?: string; quantity: number };
type StoredCart = {
  v: number;
  data: {
    lines: { variantId: string; quantity: number }[];
    ops: { opId: string; completed: boolean }[];
  };
};

const cartValue = (lines: Line[], ops: unknown[] = []) =>
  envelope({
    lines: lines.map((l) => ({ productId: SIGNATURE, addedAt: AT, ...l })),
    ops,
  });

async function seedCart(page: Page, lines: Line[], ops: unknown[] = []) {
  await seedStorage(page, { [CART_KEY]: cartValue(lines, ops) });
}

async function gotoCart(page: Page) {
  await page.goto("/cart");
  await expect(page.locator("[data-cart-line], [data-cart-empty]").first()).toBeVisible();
}

const lines = (page: Page) => page.locator("[data-cart-line]");
const lineFor = (page: Page, id: string) =>
  page.locator(`[data-cart-line][data-variant-id="${id}"]`);
const lineHeading = (line: Locator) => line.getByRole("heading", { level: 3 });
const quantityOf = (line: Locator) => line.locator("[data-quantity]");
const plus = (line: Locator) => line.getByRole("button", { name: /^Increase quantity/ });
const minus = (line: Locator) => line.getByRole("button", { name: /^Decrease quantity/ });
const removeButton = (line: Locator) => line.getByRole("button", { name: /^Remove / });
const subtotal = (page: Page) => page.locator("[data-subtotal]");
const announcer = (page: Page) => page.locator("[data-cart-announcer]");
const badge = (page: Page) => bagLink(page).locator("[data-count-badge]");

async function storedQuantities(page: Page) {
  const cart = await readStored<StoredCart>(page, CART_KEY);
  return Object.fromEntries((cart?.data.lines ?? []).map((l) => [l.variantId, l.quantity]));
}

/** Holds the cart's cross-tab lock so the next change stays pending until released. */
async function holdCartLock(page: Page) {
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
  return () => page.evaluate(() => (window as unknown as { __release: () => void }).__release());
}

test.describe("Bag page — empty and contents", () => {
  test("empty bag shows the empty state with Continue Shopping", async ({ page }) => {
    await gotoCart(page);
    await expect(page.getByRole("heading", { level: 1, name: "Your Bag" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Order summary" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /checkout/i })).toHaveCount(0);
    await expect(page.locator("[data-storage-notice]")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.getByRole("link", { name: "Continue Shopping" }).click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test("a saved bag never flashes the empty state while loading", async ({ page }) => {
    await seedCart(page, [{ variantId: V.blackM, quantity: 1 }]);
    await page.addInitScript(() => {
      new MutationObserver(() => {
        if (document.querySelector("[data-cart-empty]")) {
          (window as unknown as { __sawEmpty: boolean }).__sawEmpty = true;
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await gotoCart(page);
    await expect(lines(page)).toHaveCount(1);
    expect(
      await page.evaluate(() => (window as unknown as { __sawEmpty?: boolean }).__sawEmpty),
    ).toBeFalsy();
  });

  test("lines show image, name, colour, size, unit price, line total and the subtotal", async ({
    page,
  }) => {
    await seedCart(page, [
      { variantId: V.blackM, quantity: 2 },
      { variantId: V.offWhiteL, quantity: 1 },
    ]);
    await gotoCart(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("(3 items)");

    const black = lineFor(page, V.blackM);
    await expect(lineHeading(black)).toHaveText("Signature Oversized Tee");
    await expect(black).toContainText("Colour: Black");
    await expect(black).toContainText("Size: M");
    await expect(black).toContainText("₹1,499");
    await expect(black.getByText("Demo price")).toBeVisible();
    await expect(black.locator("[data-line-total]")).toHaveText("Line total: ₹2,998");
    await expect(quantityOf(black)).toHaveText("2");
    const image = black.locator("img");
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("src", /black-front/);

    await expect(lineFor(page, V.offWhiteL)).toContainText("Colour: Off-White");
    await expect(page.locator("[data-summary-items]")).toHaveText("3 items");
    await expect(subtotal(page)).toHaveText("₹4,497");
    await expect(page.getByText("Subtotal (demo prices)")).toBeVisible();
    await expect(page.getByText("Shipping and taxes are not calculated yet.")).toBeVisible();

    const checkout = page.getByRole("button", { name: "Checkout — Coming Soon" });
    await expect(checkout).toBeDisabled();
    await expect(page.getByText("No payment is taken on this site.")).toBeVisible();

    // The name links to the product page in the line's colour.
    await lineHeading(black).getByRole("link").click();
    await expect(page).toHaveURL(/\/product\/signature-oversized-tee\?colour=black$/);
    await waitForProductView(page);
    await expect(page.getByText("Colour: Black").filter({ visible: true })).toBeVisible();
  });
});

test.describe("Bag page — quantities", () => {
  test("+ and − update quantity, totals, header badge and storage; − is disabled at 1", async ({
    page,
  }) => {
    await seedCart(page, [{ variantId: V.blackM, quantity: 1 }]);
    await gotoCart(page);
    const line = lineFor(page, V.blackM);
    await expect(minus(line)).toBeDisabled();
    await expect(badge(page)).toHaveText("1");

    await plus(line).click();
    await expect(quantityOf(line)).toHaveText("2");
    await expect(line.locator("[data-line-total]")).toContainText("₹2,998");
    await expect(subtotal(page)).toHaveText("₹2,998");
    await expect(badge(page)).toHaveText("2");
    await expect(announcer(page)).toHaveText("Signature Oversized Tee, Black, M: quantity 2.");
    expect(await storedQuantities(page)).toEqual({ [V.blackM]: 2 });

    await minus(line).click();
    await expect(quantityOf(line)).toHaveText("1");
    await expect(minus(line)).toBeDisabled();
    await expect(badge(page)).toHaveText("1");
    expect(await storedQuantities(page)).toEqual({ [V.blackM]: 1 });
  });

  test("+ stops at the demo stock (2) and at the 10 maximum", async ({ page }) => {
    await seedCart(page, [
      { variantId: V.whiteM, quantity: 1 },
      { variantId: V.blackS, quantity: 9 },
    ]);
    await gotoCart(page);
    const white = lineFor(page, V.whiteM);
    await plus(white).click();
    await expect(quantityOf(white)).toHaveText("2");
    await expect(plus(white)).toBeDisabled();
    await expect(white.locator("[data-line-hint]")).toHaveText("Only 2 available (demo stock).");

    const black = lineFor(page, V.blackS);
    await plus(black).click();
    await expect(quantityOf(black)).toHaveText("10");
    await expect(plus(black)).toBeDisabled();
    await expect(black.locator("[data-line-hint]")).toHaveText("Maximum 10 per size.");
    expect(await storedQuantities(page)).toEqual({ [V.whiteM]: 2, [V.blackS]: 10 });
  });

  test("repeated clicks while saving cause exactly one update", async ({ page }) => {
    await seedCart(page, [{ variantId: V.blackM, quantity: 1 }]);
    await gotoCart(page);
    const line = lineFor(page, V.blackM);
    const release = await holdCartLock(page);

    // Two clicks in the same task (before any re-render), then more while pending.
    await plus(line).evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(plus(line)).toBeDisabled();
    await expect(removeButton(line)).toBeDisabled();
    await plus(line).click({ force: true });
    await plus(line).dblclick({ force: true });
    expect(await storedQuantities(page)).toEqual({ [V.blackM]: 1 }); // nothing written yet

    await release();
    await expect(quantityOf(line)).toHaveText("2");
    await expect(plus(line)).toBeEnabled();
    await expect(badge(page)).toHaveText("2");
    expect(await storedQuantities(page)).toEqual({ [V.blackM]: 2 });
  });
});

test.describe("Bag page — remove and clear", () => {
  // Approved focus rule: removing the first or a middle line focuses the next line; removing the
  // bottom line focuses the previous line; removing the last remaining line focuses the
  // empty-bag heading.
  const threeLines = [
    { variantId: V.blackS, quantity: 1 },
    { variantId: V.blackM, quantity: 1 },
    { variantId: V.blackL, quantity: 1 },
  ];

  test("removing the first line focuses the next line", async ({ page }) => {
    await seedCart(page, threeLines);
    await gotoCart(page);
    await removeButton(lineFor(page, V.blackS)).click();
    await expect(lineFor(page, V.blackS)).toHaveCount(0);
    await expect(lineHeading(lineFor(page, V.blackM))).toBeFocused();
    await expect(announcer(page)).toHaveText(
      "Removed Signature Oversized Tee, Black, S from your bag.",
    );
    await expect(badge(page)).toHaveText("2");
    expect(await storedQuantities(page)).toEqual({ [V.blackM]: 1, [V.blackL]: 1 });
  });

  test("removing a middle line focuses the next line", async ({ page }) => {
    await seedCart(page, threeLines);
    await gotoCart(page);
    await removeButton(lineFor(page, V.blackM)).click();
    await expect(lineFor(page, V.blackM)).toHaveCount(0);
    await expect(lineHeading(lineFor(page, V.blackL))).toBeFocused();
    expect(await storedQuantities(page)).toEqual({ [V.blackS]: 1, [V.blackL]: 1 });
  });

  test("removing the bottom line focuses the previous line", async ({ page }) => {
    await seedCart(page, threeLines);
    await gotoCart(page);
    await removeButton(lineFor(page, V.blackL)).click();
    await expect(lineFor(page, V.blackL)).toHaveCount(0);
    await expect(lineHeading(lineFor(page, V.blackM))).toBeFocused();
    expect(await storedQuantities(page)).toEqual({ [V.blackS]: 1, [V.blackM]: 1 });
  });

  test("focus moves only after the line is really removed, even if another tab changes the bag meanwhile", async ({
    page,
    context,
  }) => {
    await seedCart(page, threeLines);
    await gotoCart(page);
    const other = await context.newPage();
    await other.goto("/faq");
    const release = await holdCartLock(other); // the removal will wait for the lock

    const first = lineFor(page, V.blackS);
    await removeButton(first).click();
    await expect(removeButton(first)).toBeDisabled(); // pending (aria-disabled)

    // Another tab changes a DIFFERENT line directly in storage → this page re-renders meanwhile.
    await other.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: CART_KEY,
      value: JSON.stringify({
        v: 1,
        rev: 7,
        updatedAt: AT,
        data: {
          lines: threeLines.map((l) => ({
            productId: SIGNATURE,
            addedAt: AT,
            ...l,
            quantity: l.variantId === V.blackL ? 3 : l.quantity,
          })),
          ops: [],
        },
      }),
    });
    await expect(quantityOf(lineFor(page, V.blackL))).toHaveText("3"); // re-rendered
    await expect(removeButton(first)).toBeFocused(); // focus NOT moved early

    await release();
    await expect(lineFor(page, V.blackS)).toHaveCount(0);
    await expect(lineHeading(lineFor(page, V.blackM))).toBeFocused(); // moved after removal
    expect(await storedQuantities(page)).toEqual({ [V.blackM]: 1, [V.blackL]: 3 }); // newer data kept
    await other.close();
  });

  test("removing the last remaining line focuses the empty-bag heading", async ({ page }) => {
    await seedCart(page, [{ variantId: V.blackM, quantity: 2 }]);
    await gotoCart(page);
    await removeButton(lineFor(page, V.blackM)).click();
    await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeFocused();
    await expect(announcer(page)).toHaveText(
      "Removed Signature Oversized Tee, Black, M from your bag.",
    );
    await expect(badge(page)).toHaveCount(0);
    expect(await storedQuantities(page)).toEqual({});
  });

  test("clear bag: Cancel / Escape change nothing; confirm empties the bag and keeps the journal", async ({
    page,
  }) => {
    const ops = [
      { opId: "op-done", variantId: V.blackM, completed: true, at: AT },
      { opId: "op-open", variantId: V.blackL, completed: false, at: AT },
    ];
    await seedCart(
      page,
      [
        { variantId: V.blackM, quantity: 2 },
        { variantId: V.blackL, quantity: 1 },
      ],
      ops,
    );
    await gotoCart(page);
    const trigger = page.getByRole("button", { name: "Clear bag" });

    // Keyboard: open, Cancel is focused first, focus is trapped, Escape closes and restores focus.
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("alertdialog", { name: "Clear your bag?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("This removes all 3 items from your bag.");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Clear bag" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused(); // trapped
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(lines(page)).toHaveCount(2);

    // Cancel button.
    await trigger.click();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(await storedQuantities(page)).toEqual({ [V.blackM]: 2, [V.blackL]: 1 });

    // Confirm.
    await trigger.click();
    await dialog.getByRole("button", { name: "Clear bag" }).click();
    await expect(dialog).toBeHidden();
    const empty = page.getByRole("heading", { name: "Your bag is empty" });
    await expect(empty).toBeVisible();
    await expect(empty).toBeFocused();
    await expect(announcer(page)).toHaveText("Your bag has been cleared.");
    await expect(badge(page)).toHaveCount(0);
    const stored = await readStored<StoredCart>(page, CART_KEY);
    expect(stored?.data.lines).toEqual([]);
    expect(stored?.data.ops.map((o) => o.opId)).toEqual(
      expect.arrayContaining(["op-done", "op-open"]),
    );
  });

  test("clear-bag wording matches the page count when items are adjusted or unavailable", async ({
    page,
  }) => {
    await seedCart(page, [
      { variantId: V.whiteM, quantity: 5 }, // adjusted: 2 counted, 3 over the limit
      { variantId: V.whiteXS, quantity: 1 }, // sold out
      { variantId: MISSING_VARIANT, quantity: 2 }, // unavailable
      { variantId: V.blackM, quantity: 1 },
    ]);
    await gotoCart(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("(3 items)");
    await expect(badge(page)).toHaveText("9");

    await page.getByRole("button", { name: "Clear bag" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Clear your bag?" });
    await expect(dialog.getByRole("paragraph").first()).toHaveText(
      "This removes everything in your bag: 3 items in your subtotal and 6 saved items that are unavailable or over the current limit. It can't be undone.",
    );
    await page.keyboard.press("Escape");
    expect(await storedQuantities(page)).toEqual({
      [V.whiteM]: 5,
      [V.whiteXS]: 1,
      [MISSING_VARIANT]: 2,
      [V.blackM]: 1,
    }); // the dialog changes nothing by itself
  });

  test("a failed clear keeps the dialog open with an error and never reports success", async ({
    page,
  }) => {
    await seedCart(page, [
      { variantId: V.blackM, quantity: 2 },
      { variantId: V.blackL, quantity: 1 },
    ]);
    await gotoCart(page);
    const before = await readRaw(page, CART_KEY);

    // Make the next bag operation fail outright (not a busy lock): reported as storage_error.
    await page.evaluate(() => {
      (navigator.locks as unknown as { request: () => Promise<never> }).request = () =>
        Promise.reject(new Error("Simulated failure"));
    });
    await page.getByRole("button", { name: "Clear bag" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Clear your bag?" });
    await dialog.getByRole("button", { name: "Clear bag" }).click();

    await expect(dialog.getByRole("alert")).toHaveText(
      "Couldn't clear your bag. Please try again.",
    );
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Clear bag" })).toBeEnabled();
    await expect(announcer(page)).toHaveText("Couldn't clear your bag. Please try again.");
    await expect(page.getByText("Your bag has been cleared.")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Your bag is empty" })).toHaveCount(0);
    await expect(lines(page)).toHaveCount(2);
    expect(await readRaw(page, CART_KEY)).toBe(before);

    // (The modal hides the rest of the page from assistive tech, so check the header after closing.)
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(badge(page)).toHaveText("3");

    // Recovered: a retry succeeds.
    await page.evaluate(() => {
      delete (navigator.locks as unknown as Record<string, unknown>).request;
    });
    await page.getByRole("button", { name: "Clear bag" }).click();
    await dialog.getByRole("button", { name: "Clear bag" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeFocused();
    await expect(announcer(page)).toHaveText("Your bag has been cleared.");
  });

  test("another tab holding the bag (busy): changes time out with a message and nothing changes", async ({
    page,
    context,
  }) => {
    test.setTimeout(90_000); // each attempt waits for the 5-second lock timeout
    await seedCart(page, [
      { variantId: V.blackM, quantity: 1 },
      { variantId: V.blackL, quantity: 1 },
    ]);
    await gotoCart(page);
    const before = await readRaw(page, CART_KEY);
    const busy = "Your bag is busy in another tab. Please try again.";

    // A second tab takes the bag's cross-tab lock and keeps it.
    const other = await context.newPage();
    await other.goto("/shop");
    const release = await holdCartLock(other);

    const line = lineFor(page, V.blackM);
    await plus(line).click();
    await expect(plus(line)).toBeDisabled(); // waiting for the lock
    await expect(line.locator("[data-line-hint]")).toHaveText(busy, { timeout: 15_000 });
    await expect(announcer(page)).toHaveText(busy);
    await expect(quantityOf(line)).toHaveText("1");

    await removeButton(line).click();
    await expect(announcer(page)).toHaveText(busy, { timeout: 15_000 });
    await expect(lineFor(page, V.blackM)).toBeVisible();
    await expect(removeButton(line)).toBeFocused(); // a failed removal leaves focus in place

    await page.getByRole("button", { name: "Clear bag" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Clear your bag?" });
    await dialog.getByRole("button", { name: "Clear bag" }).click();
    await expect(dialog.getByRole("button", { name: "Clearing…" })).toBeDisabled();
    await expect(dialog.getByRole("alert")).toHaveText(busy, { timeout: 15_000 });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // No unintended changes anywhere.
    await expect(lines(page)).toHaveCount(2);
    await expect(badge(page)).toHaveText("2");
    expect(await readRaw(page, CART_KEY)).toBe(before);

    // Once the other tab lets go, the same change works.
    await release();
    await plus(line).click();
    await expect(quantityOf(line)).toHaveText("2");
    expect(await storedQuantities(page)).toEqual({ [V.blackM]: 2, [V.blackL]: 1 });
    await other.close();
  });
});

test.describe("Bag page — availability", () => {
  test("reduced stock is shown separately from the saved quantity until 'Update to N'", async ({
    page,
  }) => {
    await seedCart(page, [{ variantId: V.whiteM, quantity: 5 }]);
    await gotoCart(page);
    const line = lineFor(page, V.whiteM);
    await expect(line).toHaveAttribute("data-line-status", "adjusted");
    await expect(quantityOf(line)).toHaveText("2");
    await expect(line.locator("[data-adjustment]")).toHaveText(
      "You had 5 — only 2 available now (demo stock).",
    );
    await expect(subtotal(page)).toHaveText("₹2,998");
    await expect(badge(page)).toHaveText("5"); // saved quantity until acknowledged
    await expect(page.locator("[data-saved-count-note]")).toContainText(
      "Your saved bag has 5 items",
    );
    await page.reload();
    await expect(quantityOf(lineFor(page, V.whiteM))).toHaveText("2");
    expect(await storedQuantities(page)).toEqual({ [V.whiteM]: 5 }); // storage untouched

    await line.getByRole("button", { name: "Update to 2" }).click();
    await expect(line).toHaveAttribute("data-line-status", "ok");
    await expect(line.locator("[data-adjustment]")).toHaveCount(0);
    await expect(badge(page)).toHaveText("2");
    await expect(page.locator("[data-saved-count-note]")).toHaveCount(0);
    expect(await storedQuantities(page)).toEqual({ [V.whiteM]: 2 });
  });

  test("− on an adjusted line also acknowledges it (from the shown quantity)", async ({ page }) => {
    await seedCart(page, [{ variantId: V.whiteM, quantity: 5 }]);
    await gotoCart(page);
    const line = lineFor(page, V.whiteM);
    await expect(plus(line)).toBeDisabled();
    await minus(line).click();
    await expect(quantityOf(line)).toHaveText("1");
    await expect(line).toHaveAttribute("data-line-status", "ok");
    expect(await storedQuantities(page)).toEqual({ [V.whiteM]: 1 });
    await expect(badge(page)).toHaveText("1");
  });

  test("sold-out lines are kept, excluded from the subtotal, and removed only by the customer", async ({
    page,
  }) => {
    await seedCart(page, [
      { variantId: V.whiteXS, quantity: 1 },
      { variantId: V.blackM, quantity: 1 },
    ]);
    await gotoCart(page);
    const soldOut = lineFor(page, V.whiteXS);
    await expect(soldOut).toHaveAttribute("data-line-status", "sold_out");
    await expect(soldOut.locator("[data-line-note]")).toContainText("Sold out (demo stock)");
    await expect(plus(soldOut)).toBeDisabled();
    await expect(minus(soldOut)).toBeDisabled();
    await expect(soldOut.locator("[data-line-total]")).toHaveText("Not included");
    await expect(subtotal(page)).toHaveText("₹1,499");
    await expect(page.locator("[data-excluded-note]")).toHaveText(
      "1 item isn't available and isn't included in the subtotal.",
    );

    await page.reload();
    await expect(lineFor(page, V.whiteXS)).toBeVisible(); // never removed automatically
    expect(await storedQuantities(page)).toEqual({ [V.whiteXS]: 1, [V.blackM]: 1 });

    await removeButton(lineFor(page, V.whiteXS)).click();
    await expect(lineFor(page, V.whiteXS)).toHaveCount(0);
    expect(await storedQuantities(page)).toEqual({ [V.blackM]: 1 });
  });

  test("unavailable variants are shown, never substituted, and removed only by the customer", async ({
    page,
  }) => {
    await seedCart(page, [
      { variantId: MISSING_VARIANT, quantity: 3 },
      { variantId: V.blackL, productId: MISSING_PRODUCT, quantity: 1 }, // variant/product mismatch
      { variantId: V.blackM, quantity: 1 },
    ]);
    await gotoCart(page);
    const missing = lineFor(page, MISSING_VARIANT);
    await expect(missing).toHaveAttribute("data-line-status", "unavailable");
    await expect(missing.locator("[data-line-note]")).toHaveText(
      "No longer available. Saved quantity: 3.",
    );
    await expect(lineHeading(missing)).toHaveText("Signature Oversized Tee"); // product still known
    await expect(missing.getByRole("button", { name: /quantity/ })).toHaveCount(0);

    const mismatch = lineFor(page, V.blackL);
    await expect(mismatch).toHaveAttribute("data-line-status", "unavailable");
    await expect(subtotal(page)).toHaveText("₹1,499");
    await expect(page.locator("[data-excluded-note]")).toContainText("2 items aren't available");
    await expect(badge(page)).toHaveText("5"); // saved units

    await page.reload();
    await expect(lines(page)).toHaveCount(3);
    await removeButton(lineFor(page, MISSING_VARIANT)).click();
    await expect(lineFor(page, MISSING_VARIANT)).toHaveCount(0);
    expect(await storedQuantities(page)).toEqual({ [V.blackL]: 1, [V.blackM]: 1 });
  });

  test("an item from a product no longer in the catalogue is labelled clearly", async ({
    page,
  }) => {
    await seedCart(page, [{ variantId: MISSING_VARIANT, productId: MISSING_PRODUCT, quantity: 1 }]);
    await gotoCart(page);
    const line = lineFor(page, MISSING_VARIANT);
    await expect(lineHeading(line)).toHaveText("Item no longer available");
    await expect(lineHeading(line).getByRole("link")).toHaveCount(0);
    await expect(subtotal(page)).toHaveText("₹0");
    await removeButton(line).click();
    await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeFocused();
  });
});

test.describe("Bag page — persistence and other tabs", () => {
  test("changes persist after a refresh", async ({ page }) => {
    await seedCart(page, [
      { variantId: V.blackM, quantity: 1 },
      { variantId: V.blackL, quantity: 1 },
    ]);
    await gotoCart(page);
    await plus(lineFor(page, V.blackM)).click();
    await expect(quantityOf(lineFor(page, V.blackM))).toHaveText("2");
    await removeButton(lineFor(page, V.blackL)).click();
    await expect(lines(page)).toHaveCount(1);

    await page.reload();
    await expect(lines(page)).toHaveCount(1);
    await expect(quantityOf(lineFor(page, V.blackM))).toHaveText("2");
    await expect(badge(page)).toHaveText("2");
  });

  test("another open tab follows changes; focus recovers if the focused line disappears", async ({
    page,
    context,
  }) => {
    await seedCart(page, [
      { variantId: V.blackM, quantity: 1 },
      { variantId: V.blackL, quantity: 1 },
    ]);
    await gotoCart(page);
    const other = await context.newPage();
    await gotoCart(other);
    await expect(lines(other)).toHaveCount(2);

    await plus(lineFor(page, V.blackM)).click();
    await expect(quantityOf(lineFor(other, V.blackM))).toHaveText("2");
    await expect(badge(other)).toHaveText("3");

    // Focus is on a line in tab A; tab B removes that line.
    await plus(lineFor(page, V.blackL)).focus();
    await removeButton(lineFor(other, V.blackL)).click();
    await expect(lineFor(page, V.blackL)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(badge(page)).toHaveText("2");

    // Newer data from tab B is never overwritten by tab A.
    await plus(lineFor(other, V.blackM)).click(); // B: 3
    await expect(quantityOf(lineFor(page, V.blackM))).toHaveText("3");
    await plus(lineFor(page, V.blackM)).click(); // A: 4, based on the fresh 3
    await expect(quantityOf(lineFor(other, V.blackM))).toHaveText("4");
    expect(await storedQuantities(page)).toEqual({ [V.blackM]: 4 });
    await other.close();
  });
});

test.describe("Bag page — storage warnings", () => {
  test("blocked storage: warns, works for this visit only, and says so", async ({ page }) => {
    await blockStorage(page);
    await gotoProduct(page, "/product/signature-oversized-tee");
    await page.getByRole("radio", { name: "M", exact: true }).check({ force: true });
    await page.getByRole("button", { name: "Add to Bag", exact: true }).click();
    await page.locator("#add-to-bag-status").getByRole("link", { name: "View Bag" }).click();

    await expect(page).toHaveURL(/\/cart$/);
    await expect(visibleNotice(page, "memory-only")).toBeVisible();
    const line = lineFor(page, V.blackM);
    await plus(line).click();
    await expect(quantityOf(line)).toHaveText("2");
    await expect(announcer(page)).toHaveText(
      "Signature Oversized Tee, Black, M: quantity 2 for this visit only — it couldn't be saved in this browser.",
    );

    await page.reload();
    await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
    await expect(visibleNotice(page, "memory-only")).toBeVisible();
  });

  test("a write that fails mid-visit is never reported as saved", async ({ page }) => {
    await seedCart(page, [{ variantId: V.blackM, quantity: 1 }]);
    await gotoCart(page);
    const before = await readRaw(page, CART_KEY);
    await page.evaluate((key) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, value: string) {
        if (k === key) throw new DOMException("Quota exceeded", "QuotaExceededError");
        return original.call(this, k, value);
      };
    }, CART_KEY);

    await plus(lineFor(page, V.blackM)).click();
    await expect(announcer(page)).toContainText("for this visit only");
    await expect(visibleNotice(page, "memory-only")).toBeVisible();
    expect(await readRaw(page, CART_KEY)).toBe(before);
  });

  test("damaged saved bag: reset with a backup copy and a notice", async ({ page }) => {
    const damaged = "{not valid json";
    await seedStorage(page, { [CART_KEY]: damaged });
    await gotoCart(page);
    await expect(page.locator('[data-storage-notice="recovered"]')).toContainText(
      "A copy of the damaged data was kept.",
    );
    await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
    const backups = await page.evaluate(
      (prefix) =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith(prefix))
          .map((k) => localStorage.getItem(k)),
      `${CART_KEY}:backup:`,
    );
    expect(backups).toEqual([damaged]);
  });

  test("bag from another version: warns and is never overwritten by bag actions", async ({
    page,
  }) => {
    const foreign = envelope({ lines: "future format" }, 99);
    await seedStorage(page, { [CART_KEY]: foreign });
    await gotoProduct(page, "/product/signature-oversized-tee");
    await page.getByRole("radio", { name: "M", exact: true }).check({ force: true });
    await page.getByRole("button", { name: "Add to Bag", exact: true }).click();
    await page.locator("#add-to-bag-status").getByRole("link", { name: "View Bag" }).click();

    await expect(visibleNotice(page, "foreign-version")).toContainText("It has not been deleted.");
    const line = lineFor(page, V.blackM);
    await plus(line).click();
    await expect(quantityOf(line)).toHaveText("2");
    await removeButton(line).click();
    await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
    expect(await readRaw(page, CART_KEY)).toBe(foreign);
  });
});

test.describe("Bag page — layout, keyboard and SEO", () => {
  test("keyboard only: change quantity and remove", async ({ page }) => {
    await seedCart(page, [
      { variantId: V.blackM, quantity: 1 },
      { variantId: V.blackL, quantity: 1 },
    ]);
    await gotoCart(page);
    const line = lineFor(page, V.blackM);
    await plus(line).focus();
    await page.keyboard.press("Enter");
    await expect(quantityOf(line)).toHaveText("2");
    await expect(plus(line)).toBeFocused(); // focus is not lost while saving
    await page.keyboard.press("Space");
    await expect(quantityOf(line)).toHaveText("3");
    await page.keyboard.press("Shift+Tab"); // − button
    await expect(minus(line)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(quantityOf(line)).toHaveText("2");
    await page.keyboard.press("Enter");
    await expect(quantityOf(line)).toHaveText("1");
    await expect(minus(line)).toBeFocused(); // still focused at the limit (aria-disabled)
    await expect(minus(line)).toBeDisabled();
    await page.keyboard.press("Enter"); // ignored at 1
    await expect(quantityOf(line)).toHaveText("1");

    await removeButton(line).focus();
    await page.keyboard.press("Enter");
    await expect(lineFor(page, V.blackM)).toHaveCount(0);
    await expect(lineHeading(lineFor(page, V.blackL))).toBeFocused();
    expect(await storedQuantities(page)).toEqual({ [V.blackL]: 1 });
  });

  test("responsive layout without overflow, including a long bag", async ({ page }, testInfo) => {
    await seedCart(
      page,
      [2, 3, 4, 5, 7, 8, 9, 10].map((i) => ({ variantId: variantId(i), quantity: 1 })),
    );
    await gotoCart(page);
    await expect(lines(page)).toHaveCount(8);
    await expectNoHorizontalOverflow(page);

    const list = await page.getByRole("list", { name: "Bag items" }).boundingBox();
    const summary = await page.getByRole("region", { name: "Order summary" }).boundingBox();
    expect(list && summary).toBeTruthy();
    if (isDesktop(testInfo)) {
      expect(summary!.x, "summary beside the list").toBeGreaterThan(list!.x + list!.width - 1);
    } else {
      expect(summary!.y, "summary below the list").toBeGreaterThan(list!.y + list!.height - 1);
    }

    const viewport = page.viewportSize()!;
    for (const button of await page.getByRole("button").all()) {
      if (!(await button.isVisible())) continue;
      const box = (await button.boundingBox())!;
      expect(box.x + box.width, "button within viewport").toBeLessThanOrEqual(viewport.width);
    }
    const stepper = await plus(lines(page).first()).boundingBox();
    expect(stepper!.height, "touch target height").toBeGreaterThanOrEqual(44);
  });

  test("is noindex, titled 'Bag', not in the sitemap, and makes no order requests", async ({
    page,
    request,
  }) => {
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET") writes.push(`${r.method()} ${r.url()}`);
    });
    await seedCart(page, [{ variantId: V.blackM, quantity: 1 }]);
    await gotoCart(page);
    await expect(page).toHaveTitle("Bag | JYGS Clothing");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await plus(lineFor(page, V.blackM)).click();
    await expect(quantityOf(lineFor(page, V.blackM))).toHaveText("2");
    expect(writes, "no POST/PUT/DELETE requests (no orders or payments)").toEqual([]);

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("/cart");
  });
});
