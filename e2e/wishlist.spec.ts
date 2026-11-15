import type { Locator, Page, TestInfo } from "@playwright/test";

import {
  bagLink,
  blockStorage,
  CART_KEY,
  envelope,
  expect,
  expectNoHorizontalOverflow,
  readRaw,
  readStored,
  seedStorage,
  test,
  WISHLIST_KEY,
} from "./fixtures";

/**
 * M3.4 — wishlist hearts (Shop / Category / Collection cards only) and the /wishlist page.
 * IDs follow the mock catalogue (`mockId`): products ns 4, colours ns 2, variants ns 6.
 */
const id = (ns: number, n: number) =>
  `00000000-0000-4000-8${ns.toString().padStart(3, "0")}-${n.toString().padStart(12, "0")}`;
const SIGNATURE = id(4, 1);
const PINE = id(4, 8); // Pine Monogram: sold out
const MISSING_PRODUCT = id(4, 999);
const C = { black: id(2, 1), offWhite: id(2, 2), cherry: id(2, 3), white: id(2, 7) };
const V = { blackM: id(6, 103), whiteM: id(6, 113) }; // white M: demo stock 2
const NAME = "Signature Oversized Tee";
const AT = "2026-11-14T09:00:00.000Z";
const PAST = "2026-01-01T00:00:00.000Z";
const future = () => new Date(Date.now() + 10 * 60_000).toISOString();

type Item = { productId: string; colourId: string | null; pendingMove?: unknown };
type StoredWishlist = { data: { items: (Item & { addedAt: string })[] } };
type StoredCart = {
  data: {
    lines: { variantId: string; quantity: number }[];
    ops: { opId: string; completed: boolean }[];
  };
};

const wishlistValue = (items: Item[]) =>
  envelope({ items: items.map((i) => ({ addedAt: AT, ...i })) });
const cartValue = (
  lines: { variantId: string; quantity: number }[],
  ops: { opId: string; variantId: string; completed: boolean }[] = [],
) =>
  envelope({
    lines: lines.map((l) => ({ productId: SIGNATURE, addedAt: AT, ...l })),
    ops: ops.map((o) => ({ at: AT, ...o })),
  });
const marker = (owner: string, leaseExpiresAt: string) => ({
  opId: "op-1",
  variantId: V.blackM,
  owner,
  startedAt: AT,
  leaseExpiresAt,
});

/** Seeds wishlist and/or bag in ONE init script (seedStorage seeds once per tab). */
async function seed(page: Page, data: { wishlist?: Item[]; cart?: string }) {
  await seedStorage(page, {
    ...(data.wishlist ? { [WISHLIST_KEY]: wishlistValue(data.wishlist) } : {}),
    ...(data.cart ? { [CART_KEY]: data.cart } : {}),
  });
}

const signatureCard = (page: Page) =>
  page.locator("main article").filter({ has: page.getByRole("heading", { name: NAME }) });
const heartOf = (card: Locator) => card.locator("[data-wishlist-heart]");
const heartAnnouncer = (card: Locator) => card.locator("[data-heart-announcer]");
const rows = (page: Page) => page.locator("[data-wishlist-item]");
const rowFor = (page: Page, productId: string) =>
  page.locator(`[data-wishlist-item][data-product-id="${productId}"]`);
const rowHeading = (row: Locator) => row.getByRole("heading", { level: 3 });
const addButton = (row: Locator) => row.getByRole("button", { name: "Add to Bag" });
const removeButton = (row: Locator) => row.getByRole("button", { name: /^Remove / });
const announcer = (page: Page) => page.locator("[data-wishlist-announcer]");
const confirmation = (page: Page) => page.locator("[data-wishlist-confirmation]");

const LABEL = {
  none: (colour: string) => `${NAME}, not in wishlist. Save in ${colour}.`,
  saved: (colour: string) => `${NAME}, saved in ${colour}. Remove from wishlist.`,
  other: (saved: string, card: string) =>
    `${NAME}, saved in ${saved}. Change saved colour to ${card}.`,
  noColour: (card: string) => `${NAME}, saved without a colour. Save in ${card}.`,
};

async function storedItems(page: Page) {
  return (await readStored<StoredWishlist>(page, WISHLIST_KEY))?.data.items ?? [];
}
async function storedCart(page: Page) {
  return (await readStored<StoredCart>(page, CART_KEY))?.data ?? { lines: [], ops: [] };
}

async function gotoShop(page: Page, url = "/shop") {
  await page.goto(url);
  await expect(heartOf(signatureCard(page))).not.toHaveAttribute("data-wishlist-state", "loading");
}
async function gotoWishlist(page: Page) {
  await page.goto("/wishlist");
  await expect(page.locator("[data-wishlist-item], [data-wishlist-empty]").first()).toBeVisible();
}

/** The wishlist count: header link (tablet/desktop) or mobile menu link. */
async function expectWishlistCount(page: Page, testInfo: TestInfo, count: number) {
  const name = count > 0 ? `Wishlist, ${count} ${count === 1 ? "item" : "items"}` : "Wishlist";
  if (testInfo.project.name === "mobile") {
    await page.getByRole("banner").getByRole("button", { name: "Open menu" }).click();
    await expect(
      page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name, exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByRole("banner").getByRole("link", { name, exact: true })).toBeVisible();
  }
}

/** Holds a cross-tab lock in `page` until the returned function is called. */
async function holdLock(page: Page, key: string) {
  await page.evaluate(
    (k) =>
      new Promise<void>((acquired) => {
        void navigator.locks.request(k, () => {
          acquired();
          return new Promise<void>((release) => {
            (window as unknown as { __release: () => void }).__release = release;
          });
        });
      }),
    key,
  );
  return () => page.evaluate(() => (window as unknown as { __release: () => void }).__release());
}

/** Removes Web Locks before any script runs (the app falls back to in-tab locks). */
async function disableWebLocks(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "locks", { configurable: true, get: () => undefined });
  });
}

// ---------------------------------------------------------------------------------------------

test.describe("Wishlist hearts — placement", () => {
  test("hearts on Shop, Category and Collection cards only", async ({ page }) => {
    for (const url of ["/shop", "/category/unisex", "/collections/new-arrivals"]) {
      await page.goto(url);
      const cards = page.locator("main article");
      await expect(cards.first()).toBeVisible();
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      await expect(page.locator("main article [data-wishlist-heart]")).toHaveCount(count);
    }
    await page.goto("/");
    await expect(page.locator("main article").first()).toBeVisible();
    await expect(page.locator("[data-wishlist-heart]")).toHaveCount(0);

    await page.goto("/product/signature-oversized-tee");
    await expect(page.locator("#related article").first()).toBeVisible();
    await expect(page.locator("[data-wishlist-heart]")).toHaveCount(0);
  });

  test("before the wishlist loads, hearts are outline, aria-disabled and inert", async ({
    request,
  }) => {
    // The server-rendered listing (before any browser storage is read).
    const html = await (await request.get("/shop")).text();
    const hearts = html.match(/<button[^>]*data-wishlist-heart[^>]*>/g) ?? [];
    expect(hearts.length).toBeGreaterThan(0);
    for (const heart of hearts) {
      expect(heart).toContain('aria-disabled="true"');
      expect(heart).toContain('data-wishlist-state="loading"');
      expect(heart).not.toContain("aria-pressed");
    }
  });
});

test.describe("Wishlist hearts — three states", () => {
  test("not saved → saved in this colour (label, announcement, storage, count, refresh)", async ({
    page,
  }, testInfo) => {
    await gotoShop(page);
    const card = signatureCard(page);
    const heart = card.getByRole("button", { name: LABEL.none("Black"), exact: true });
    await expect(heart).toHaveAttribute("data-wishlist-state", "none");
    await expect(heart).not.toHaveAttribute("aria-pressed");

    await heart.click();
    const saved = card.getByRole("button", { name: LABEL.saved("Black"), exact: true });
    await expect(saved).toHaveAttribute("data-wishlist-state", "saved");
    await expect(saved).not.toHaveAttribute("aria-pressed");
    await expect(heartAnnouncer(card)).toHaveText(`${NAME} saved to your wishlist in Black.`);
    expect(await storedItems(page)).toEqual([
      expect.objectContaining({ productId: SIGNATURE, colourId: C.black }),
    ]);
    await expectWishlistCount(page, testInfo, 1);

    await page.reload();
    await expect(
      signatureCard(page).getByRole("button", { name: LABEL.saved("Black"), exact: true }),
    ).toBeVisible();
  });

  test("saved in this colour → removed", async ({ page }, testInfo) => {
    await seed(page, { wishlist: [{ productId: SIGNATURE, colourId: C.black }] });
    await gotoShop(page);
    const card = signatureCard(page);
    await card.getByRole("button", { name: LABEL.saved("Black"), exact: true }).click();
    await expect(
      card.getByRole("button", { name: LABEL.none("Black"), exact: true }),
    ).toHaveAttribute("data-wishlist-state", "none");
    await expect(heartAnnouncer(card)).toHaveText(`${NAME} removed from your wishlist.`);
    expect(await storedItems(page)).toEqual([]);
    await expectWishlistCount(page, testInfo, 0);
  });

  test("saved in another colour → the saved colour changes (announced, one entry)", async ({
    page,
  }, testInfo) => {
    await seed(page, { wishlist: [{ productId: SIGNATURE, colourId: C.black }] });
    await gotoShop(page, "/shop?colour=white");
    const card = signatureCard(page);
    const other = card.getByRole("button", { name: LABEL.other("Black", "White"), exact: true });
    await expect(other).toHaveAttribute("data-wishlist-state", "other-colour");
    await expect(other).toHaveAttribute("title", "Saved in Black");

    await other.click();
    await expect(heartAnnouncer(card)).toHaveText(
      `Saved colour of ${NAME} changed from Black to White.`,
    );
    await expect(
      card.getByRole("button", { name: LABEL.saved("White"), exact: true }),
    ).toHaveAttribute("data-wishlist-state", "saved");
    const items = await storedItems(page);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ productId: SIGNATURE, colourId: C.white, addedAt: AT });
    await expectWishlistCount(page, testInfo, 1);
  });

  test("saved without a colour → the colour is set", async ({ page }) => {
    await seed(page, { wishlist: [{ productId: SIGNATURE, colourId: null }] });
    await gotoShop(page);
    const card = signatureCard(page);
    await card.getByRole("button", { name: LABEL.noColour("Black"), exact: true }).click();
    await expect(heartAnnouncer(card)).toHaveText(`${NAME} is now saved in Black.`);
    expect(await storedItems(page)).toEqual([
      expect.objectContaining({ productId: SIGNATURE, colourId: C.black }),
    ]);
  });

  test("repeated clicks while saving cause one change", async ({ page }) => {
    await gotoShop(page);
    const heart = heartOf(signatureCard(page));
    const release = await holdLock(page, WISHLIST_KEY);
    await heart.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(heart).toHaveAttribute("aria-disabled", "true");
    await heart.click({ force: true });
    expect(await storedItems(page)).toEqual([]); // nothing written while pending
    await release();
    await expect(heart).toHaveAttribute("data-wishlist-state", "saved"); // not toggled back
    expect(await storedItems(page)).toHaveLength(1);
  });

  test("keyboard: Tab from the card link to the heart; Enter and Space; focus kept", async ({
    page,
  }) => {
    await gotoShop(page);
    const card = signatureCard(page);
    await card.getByRole("link").first().focus();
    await page.keyboard.press("Tab");
    const heart = heartOf(card);
    await expect(heart).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(heart).toHaveAttribute("data-wishlist-state", "saved");
    await expect(heart).toBeFocused();
    await page.keyboard.press("Space");
    await expect(heart).toHaveAttribute("data-wishlist-state", "none");
    await expect(heart).toBeFocused();
  });

  test("two tabs: a change in one updates the other's heart and label", async ({
    page,
    context,
  }) => {
    await gotoShop(page); // shows Black
    const other = await context.newPage();
    await gotoShop(other, "/shop?colour=white");

    await heartOf(signatureCard(page)).click();
    await expect(
      signatureCard(other).getByRole("button", {
        name: LABEL.other("Black", "White"),
        exact: true,
      }),
    ).toBeVisible();

    await heartOf(signatureCard(other)).click(); // change to White
    await expect(
      signatureCard(page).getByRole("button", { name: LABEL.other("White", "Black"), exact: true }),
    ).toBeVisible();
    expect(await storedItems(page)).toEqual([expect.objectContaining({ colourId: C.white })]);
    await other.close();
  });
});

test.describe("Wishlist hearts — pending moves", () => {
  test("interrupted move whose add reached the bag: recovered first, bag unchanged", async ({
    page,
  }) => {
    await seed(page, {
      wishlist: [
        { productId: SIGNATURE, colourId: C.black, pendingMove: marker("tab-gone", PAST) },
      ],
      cart: cartValue(
        [{ variantId: V.blackM, quantity: 1 }],
        [{ opId: "op-1", variantId: V.blackM, completed: false }],
      ),
    });
    await gotoShop(page);
    const card = signatureCard(page);
    await heartOf(card).click();
    await expect(heartAnnouncer(card)).toHaveText(`${NAME} was already moved to your bag.`);
    expect(await storedItems(page)).toEqual([]);
    const cart = await storedCart(page);
    expect(cart.lines.map((l) => l.quantity)).toEqual([1]); // no duplicate
    expect(cart.ops.find((o) => o.opId === "op-1")?.completed).toBe(true);
  });

  test("interrupted move whose add never happened: marker cleared, heart applies", async ({
    page,
  }) => {
    await seed(page, {
      wishlist: [
        { productId: SIGNATURE, colourId: C.black, pendingMove: marker("tab-gone", PAST) },
      ],
    });
    await gotoShop(page);
    const card = signatureCard(page);
    await heartOf(card).click();
    await expect(heartAnnouncer(card)).toHaveText(`${NAME} removed from your wishlist.`);
    expect(await storedItems(page)).toEqual([]);
    expect((await storedCart(page)).lines).toEqual([]);
  });

  test("no Web Locks: another tab's move (valid lease) is refused; an expired one recovers", async ({
    page,
  }) => {
    await disableWebLocks(page);
    await seed(page, {
      wishlist: [
        { productId: SIGNATURE, colourId: C.black, pendingMove: marker("tab-other", future()) },
      ],
    });
    await gotoShop(page);
    const card = signatureCard(page);
    const before = await readRaw(page, WISHLIST_KEY);
    await heartOf(card).click();
    await expect(heartAnnouncer(card)).toHaveText(
      "This item is being moved to your bag in another tab. Try again in a moment.",
    );
    expect(await readRaw(page, WISHLIST_KEY)).toBe(before);
    expect(await readRaw(page, CART_KEY)).toBeNull();

    // The other tab's lease runs out → the move counts as interrupted and is recovered.
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: WISHLIST_KEY,
      value: wishlistValue([
        { productId: SIGNATURE, colourId: C.black, pendingMove: marker("tab-other", PAST) },
      ]),
    });
    await page.reload();
    await expect(heartOf(signatureCard(page))).toHaveAttribute("data-wishlist-state", "saved");
    await heartOf(signatureCard(page)).click();
    await expect(heartAnnouncer(signatureCard(page))).toHaveText(
      `${NAME} removed from your wishlist.`,
    );
    expect(await storedItems(page)).toEqual([]);
  });

  test("active move: a heart removal while the move waits → the move adds nothing", async ({
    page,
    context,
  }) => {
    await seed(page, { wishlist: [{ productId: SIGNATURE, colourId: C.black }] });
    await gotoWishlist(page);
    // Open the other tabs first: the waiting move gives up after the 5-second lock timeout.
    const shop = await context.newPage();
    await gotoShop(shop);
    const holder = await context.newPage();
    await holder.goto("/faq");
    const row = rowFor(page, SIGNATURE);
    await row.getByRole("radio", { name: "M", exact: true }).check({ force: true });
    const release = await holdLock(holder, CART_KEY);

    // Move starts and waits for the bag lock.
    await addButton(row).click();
    await expect(addButton(row)).toHaveAttribute("aria-disabled", "true");

    // Meanwhile another tab removes it with the heart.
    await heartOf(signatureCard(shop)).click();
    await expect(heartAnnouncer(signatureCard(shop))).toHaveText(
      `${NAME} removed from your wishlist.`,
    );

    await release();
    await expect(confirmation(page)).toContainText("Nothing was added.");
    expect((await storedCart(page)).lines).toEqual([]);
    expect(await storedItems(page)).toEqual([]);
    await holder.close();
    await shop.close();
  });
});

test.describe("Wishlist page — contents and Add to Bag", () => {
  test("empty wishlist: empty state with Continue Shopping; no flash when items exist", async ({
    page,
  }) => {
    await gotoWishlist(page);
    await expect(page.getByRole("heading", { level: 1, name: "Wishlist" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toBeVisible();
    await page.getByRole("link", { name: "Continue Shopping" }).click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test("a saved wishlist never flashes the empty state", async ({ page }) => {
    await seed(page, { wishlist: [{ productId: SIGNATURE, colourId: C.black }] });
    await page.addInitScript(() => {
      new MutationObserver(() => {
        if (document.querySelector("[data-wishlist-empty]")) {
          (window as unknown as { __sawEmpty: boolean }).__sawEmpty = true;
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await gotoWishlist(page);
    await expect(rows(page)).toHaveCount(1);
    expect(
      await page.evaluate(() => (window as unknown as { __sawEmpty?: boolean }).__sawEmpty),
    ).toBeFalsy();
  });

  test("row shows image, name link, saved colour and demo price", async ({ page }) => {
    await seed(page, { wishlist: [{ productId: SIGNATURE, colourId: C.white }] });
    await gotoWishlist(page);
    const row = rowFor(page, SIGNATURE);
    await expect(row).toHaveAttribute("data-item-status", "ok");
    await expect(rowHeading(row).getByRole("link")).toHaveAttribute(
      "href",
      "/product/signature-oversized-tee?colour=white",
    );
    await expect(row).toContainText("Colour: White");
    await expect(row).toContainText("₹1,499");
    await expect(row.getByText("Demo price")).toBeVisible();
    await expect(row.locator("img")).toHaveAttribute("src", /white-front/);
    await expect(row.getByRole("radio", { name: "XS — sold out" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "Continue Shopping" })).toBeVisible();
  });

  test("Add to Bag without a size: alert, focus on the sizes, nothing changes", async ({
    page,
  }) => {
    await seed(page, { wishlist: [{ productId: SIGNATURE, colourId: C.black }] });
    await gotoWishlist(page);
    const row = rowFor(page, SIGNATURE);
    await addButton(row).click();
    await expect(row.getByRole("alert")).toHaveText("Please select a size.");
    await expect(row.locator('input[type="radio"]:focus')).toHaveCount(1);
    expect(await storedItems(page)).toHaveLength(1);
    expect(await readRaw(page, CART_KEY)).toBeNull();
  });

  test("Add to Bag success: into the bag, out of the wishlist, confirmation with View Bag", async ({
    page,
  }, testInfo) => {
    await seed(page, { wishlist: [{ productId: SIGNATURE, colourId: C.black }] });
    await gotoWishlist(page);
    const row = rowFor(page, SIGNATURE);
    await row.getByRole("radio", { name: "M", exact: true }).check({ force: true });
    await addButton(row).click();

    await expect(confirmation(page)).toContainText(`Added ${NAME}, Black, M to your bag.`);
    await expect(confirmation(page).getByRole("link", { name: "View Bag" })).toHaveAttribute(
      "href",
      "/cart",
    );
    await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toBeFocused();
    expect(await storedItems(page)).toEqual([]);
    expect((await storedCart(page)).lines).toEqual([
      expect.objectContaining({ variantId: V.blackM, quantity: 1 }),
    ]);
    await expect(bagLink(page).locator("[data-count-badge]")).toHaveText("1");
    await expectWishlistCount(page, testInfo, 0);
  });

  test("Add to Bag failures keep the item and change nothing", async ({ page }) => {
    // The bag already has the maximum White M (demo stock 2).
    await seed(page, {
      wishlist: [{ productId: SIGNATURE, colourId: C.white }],
      cart: cartValue([{ variantId: V.whiteM, quantity: 2 }]),
    });
    await gotoWishlist(page);
    const row = rowFor(page, SIGNATURE);
    await row.getByRole("radio", { name: "M", exact: true }).check({ force: true });
    await addButton(row).click();
    await expect(row.locator("[data-item-message]")).toHaveText(
      "Your bag already has the maximum available in this size.",
    );
    expect(await storedItems(page)).toHaveLength(1);
    expect((await storedCart(page)).lines.map((l) => l.quantity)).toEqual([2]);

    // A forced failure (not a busy lock).
    await page.evaluate(() => {
      (navigator.locks as unknown as { request: () => Promise<never> }).request = () =>
        Promise.reject(new Error("Simulated failure"));
    });
    await row.getByRole("radio", { name: "L", exact: true }).check({ force: true });
    await addButton(row).click();
    await expect(row.locator("[data-item-message]")).toHaveText(
      "Couldn't add to your bag. Please try again.",
    );
    await expect(confirmation(page)).toHaveCount(0); // never a success message
    expect(await storedItems(page)).toHaveLength(1);
    expect((await storedCart(page)).lines.map((l) => l.quantity)).toEqual([2]);
  });

  test("Add to Bag while another tab is busy: times out with a message, nothing changes", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await seed(page, { wishlist: [{ productId: SIGNATURE, colourId: C.black }] });
    await gotoWishlist(page);
    const holder = await context.newPage();
    await holder.goto("/faq");
    const release = await holdLock(holder, CART_KEY);
    const row = rowFor(page, SIGNATURE);
    await row.getByRole("radio", { name: "M", exact: true }).check({ force: true });
    await addButton(row).click();
    await expect(row.locator("[data-item-message]")).toHaveText(
      "Your bag is busy in another tab. Please try again.",
      { timeout: 15_000 },
    );
    expect(await storedItems(page)).toHaveLength(1);
    expect(await readRaw(page, CART_KEY)).toBeNull();
    await release();
    await holder.close();
  });

  test("sold out in the saved colour and unavailable products: no Add to Bag", async ({ page }) => {
    await seed(page, {
      wishlist: [
        { productId: PINE, colourId: id(2, 4) },
        { productId: MISSING_PRODUCT, colourId: C.black },
      ],
    });
    await gotoWishlist(page);
    const pine = rowFor(page, PINE);
    await expect(pine.locator("[data-item-note]")).toHaveText(
      "Sold out in this colour (demo stock).",
    );
    await expect(addButton(pine)).toHaveAttribute("aria-disabled", "true");
    for (const radio of await pine.getByRole("radio").all()) await expect(radio).toBeDisabled();
    await addButton(pine).click({ force: true });
    expect(await readRaw(page, CART_KEY)).toBeNull();

    const missing = rowFor(page, MISSING_PRODUCT);
    await expect(rowHeading(missing)).toHaveText("Item no longer available");
    await expect(missing.locator("[data-item-note]")).toHaveText("No longer available.");
    await expect(addButton(missing)).toHaveCount(0);
    await removeButton(missing).click();
    await expect(rowFor(page, MISSING_PRODUCT)).toHaveCount(0);
  });
});

test.describe("Wishlist page — saved colour missing", () => {
  for (const testCase of [
    {
      title: "no colour saved",
      colourId: null,
      note: "No colour was saved for this item. Choose a colour on the product page.",
      status: "no_colour",
    },
    {
      title: "saved colour no longer offered",
      colourId: C.cherry, // Signature has no Cherry
      note: "Your saved colour is no longer available. Choose another colour on the product page.",
      status: "colour_unavailable",
    },
  ]) {
    test(`${testCase.title}: explained, sizes and Add to Bag disabled, no substitute`, async ({
      page,
    }) => {
      await seed(page, { wishlist: [{ productId: SIGNATURE, colourId: testCase.colourId }] });
      await gotoWishlist(page);
      const row = rowFor(page, SIGNATURE);
      await expect(row).toHaveAttribute("data-item-status", testCase.status);
      await expect(row.locator("[data-item-note]")).toContainText(testCase.note);
      await expect(row).not.toContainText("Colour: "); // no colour shown or chosen
      const radios = row.getByRole("radio");
      await expect(radios).toHaveCount(5);
      for (const radio of await radios.all()) {
        await expect(radio).toBeDisabled();
        await expect(radio).not.toBeChecked();
      }
      await expect(addButton(row)).toHaveAttribute("aria-disabled", "true");
      await expect(row.getByRole("link", { name: "Choose a colour" })).toHaveAttribute(
        "href",
        "/product/signature-oversized-tee",
      );
      await expect(rowHeading(row).getByRole("link")).toHaveAttribute(
        "href",
        "/product/signature-oversized-tee",
      );

      await addButton(row).click({ force: true });
      expect(await readRaw(page, CART_KEY)).toBeNull();
      await page.reload();
      await expect(rowFor(page, SIGNATURE)).toHaveAttribute("data-item-status", testCase.status);
      expect(await storedItems(page)).toEqual([
        expect.objectContaining({ colourId: testCase.colourId }),
      ]);

      await removeButton(rowFor(page, SIGNATURE)).click();
      await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toBeFocused();
    });
  }
});

test.describe("Wishlist page — recovery on load and Remove", () => {
  test("recovery on load: an add already in the bag → item removed, bag unchanged", async ({
    page,
  }) => {
    await seed(page, {
      wishlist: [
        { productId: SIGNATURE, colourId: C.black, pendingMove: marker("tab-gone", PAST) },
      ],
      cart: cartValue(
        [{ variantId: V.blackM, quantity: 1 }],
        [{ opId: "op-1", variantId: V.blackM, completed: false }],
      ),
    });
    await gotoWishlist(page);
    await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toBeVisible();
    await expect(announcer(page)).toHaveText(
      `${NAME} was already added to your bag earlier — removed from your wishlist.`,
    );
    const cart = await storedCart(page);
    expect(cart.lines.map((l) => l.quantity)).toEqual([1]);
    expect(cart.ops.find((o) => o.opId === "op-1")?.completed).toBe(true);
  });

  test("recovery on load: an add that never happened → marker cleared, item kept", async ({
    page,
  }) => {
    await seed(page, {
      wishlist: [
        { productId: SIGNATURE, colourId: C.black, pendingMove: marker("tab-gone", PAST) },
      ],
    });
    await gotoWishlist(page);
    await expect(rowFor(page, SIGNATURE)).toBeVisible();
    await expect.poll(async () => (await storedItems(page))[0]?.pendingMove).toBeUndefined();
    await expect(rowFor(page, SIGNATURE).locator("[data-recovery-note]")).toHaveCount(0);
    expect(await readRaw(page, CART_KEY)).toBeNull();
  });

  test("recovery blocked: message shown; a later Add to Bag never adds twice", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await seed(page, {
      wishlist: [
        { productId: SIGNATURE, colourId: C.black, pendingMove: marker("tab-gone", PAST) },
      ],
      cart: cartValue(
        [{ variantId: V.blackM, quantity: 1 }],
        [{ opId: "op-1", variantId: V.blackM, completed: false }],
      ),
    });
    const holder = await context.newPage();
    await holder.goto("/faq");
    const release = await holdLock(holder, CART_KEY);
    await gotoWishlist(page);
    const row = rowFor(page, SIGNATURE);
    await expect(row.locator("[data-recovery-note]")).toContainText(
      "We couldn't finish moving this item to your bag.",
      { timeout: 15_000 },
    );
    await expect(
      row.locator("[data-recovery-note]").getByRole("link", { name: "View Bag" }),
    ).toHaveAttribute("href", "/cart");
    await release();

    await row.getByRole("radio", { name: "M", exact: true }).check({ force: true });
    await addButton(row).click();
    await expect(confirmation(page)).toContainText("already in your bag from an earlier attempt");
    expect((await storedCart(page)).lines.map((l) => l.quantity)).toEqual([1]); // not 2
    expect(await storedItems(page)).toEqual([]);
    await holder.close();
  });

  test("Remove is refused while another tab is moving the item (no Web Locks)", async ({
    page,
  }) => {
    await disableWebLocks(page);
    await seed(page, {
      wishlist: [
        { productId: SIGNATURE, colourId: C.black, pendingMove: marker("tab-other", future()) },
      ],
    });
    await gotoWishlist(page);
    const row = rowFor(page, SIGNATURE);
    await expect(row.locator("[data-recovery-note]")).toBeVisible(); // load recovery: in progress
    const before = await readRaw(page, WISHLIST_KEY);
    await removeButton(row).click();
    await expect(row.locator("[data-item-message]")).toHaveText(
      "This item is being moved to your bag in another tab. Try again in a moment.",
    );
    expect(await readRaw(page, WISHLIST_KEY)).toBe(before);
  });

  test("Remove while another tab holds the bag lock: busy error, item kept, then succeeds once", async ({
    page,
    context,
  }) => {
    test.setTimeout(90_000); // page-load recovery and Remove each wait for the 5-second timeout
    await seed(page, {
      wishlist: [
        { productId: SIGNATURE, colourId: C.black, pendingMove: marker("tab-gone", PAST) },
      ],
      cart: cartValue(
        [{ variantId: V.blackM, quantity: 1 }],
        [{ opId: "op-1", variantId: V.blackM, completed: false }],
      ),
    });
    const holder = await context.newPage();
    await holder.goto("/faq");
    const release = await holdLock(holder, CART_KEY); // the other tab is mid-move

    await gotoWishlist(page);
    const row = rowFor(page, SIGNATURE);
    await expect(row.locator("[data-recovery-note]")).toBeVisible({ timeout: 15_000 });
    const wishlistBefore = await readRaw(page, WISHLIST_KEY);
    const cartBefore = await readRaw(page, CART_KEY);

    await removeButton(row).click();
    await expect(removeButton(row)).toHaveAttribute("aria-disabled", "true"); // waiting
    await expect(row.locator("[data-item-message]")).toHaveText(
      "Your wishlist is busy in another tab. Please try again.",
      { timeout: 15_000 },
    );
    await expect(announcer(page)).toHaveText(
      "Your wishlist is busy in another tab. Please try again.",
    );
    await expect(page.getByText(/^Removed /)).toHaveCount(0); // no false success
    await expect(rowFor(page, SIGNATURE)).toBeVisible();
    expect(await readRaw(page, WISHLIST_KEY)).toBe(wishlistBefore);
    expect(await readRaw(page, CART_KEY)).toBe(cartBefore);

    // The other tab lets go: recovery finds the earlier add and removes the item — no duplicate.
    await release();
    await removeButton(row).click();
    await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toBeFocused();
    await expect(announcer(page)).toHaveText(`${NAME}, Black was already moved to your bag.`);
    expect((await storedCart(page)).lines.map((l) => l.quantity)).toEqual([1]);
    await holder.close();
  });

  test("Remove when recovery fails: error, item kept, bag unchanged, no false success", async ({
    page,
  }) => {
    await seed(page, {
      wishlist: [
        { productId: SIGNATURE, colourId: C.black, pendingMove: marker("tab-gone", PAST) },
      ],
      cart: cartValue(
        [{ variantId: V.blackM, quantity: 1 }],
        [{ opId: "op-1", variantId: V.blackM, completed: false }],
      ),
    });
    // Every write to the wishlist fails (installed after seeding, before the app starts).
    await page.addInitScript((key) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, value: string) {
        if (k === key) throw new DOMException("Quota exceeded", "QuotaExceededError");
        return original.call(this, k, value);
      };
    }, WISHLIST_KEY);
    await gotoWishlist(page);
    const row = rowFor(page, SIGNATURE);
    await expect(row.locator("[data-recovery-note]")).toBeVisible(); // load recovery failed too
    const wishlistBefore = await readRaw(page, WISHLIST_KEY);

    await removeButton(row).click();
    await expect(row.locator("[data-item-message]")).toHaveText(
      "Couldn't update your wishlist. Please try again.",
    );
    await expect(page.getByText(/^Removed /)).toHaveCount(0);
    await expect(rowFor(page, SIGNATURE)).toBeVisible();
    await expect(removeButton(row)).toBeFocused(); // focus stays on the failed action
    expect(await readRaw(page, WISHLIST_KEY)).toBe(wishlistBefore);
    expect((await storedCart(page)).lines.map((l) => l.quantity)).toEqual([1]);
  });

  const three = [
    { productId: SIGNATURE, colourId: C.black },
    { productId: id(4, 2), colourId: null },
    { productId: id(4, 3), colourId: null },
  ];

  test("Remove focus: first row → next row", async ({ page }) => {
    await seed(page, { wishlist: three });
    await gotoWishlist(page);
    await removeButton(rowFor(page, SIGNATURE)).click();
    await expect(rowFor(page, SIGNATURE)).toHaveCount(0);
    await expect(rowHeading(rowFor(page, id(4, 2)))).toBeFocused();
    await expect(announcer(page)).toHaveText(`Removed ${NAME}, Black from your wishlist.`);
  });

  test("Remove focus: middle row → next row", async ({ page }) => {
    await seed(page, { wishlist: three });
    await gotoWishlist(page);
    await removeButton(rowFor(page, id(4, 2))).click();
    await expect(rowHeading(rowFor(page, id(4, 3)))).toBeFocused();
  });

  test("Remove focus: bottom row → previous row; last row → empty heading", async ({
    page,
  }, testInfo) => {
    await seed(page, { wishlist: three.slice(0, 2) });
    await gotoWishlist(page);
    await removeButton(rowFor(page, id(4, 2))).click();
    await expect(rowHeading(rowFor(page, SIGNATURE))).toBeFocused();
    await removeButton(rowFor(page, SIGNATURE)).click();
    await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toBeFocused();
    expect(await storedItems(page)).toEqual([]);
    await expectWishlistCount(page, testInfo, 0);
  });
});

test.describe("Wishlist — storage warnings", () => {
  test("blocked storage: warns, hearts work for this visit only and say so", async ({ page }) => {
    await blockStorage(page);
    await gotoShop(page);
    const card = signatureCard(page);
    await heartOf(card).click();
    await expect(heartAnnouncer(card)).toHaveText(
      `${NAME} saved to your wishlist in Black for this visit only — it couldn't be saved in this browser.`,
    );
    await page.goto("/wishlist");
    await expect(page.locator('[data-storage-notice="memory-only"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toBeVisible();
  });

  test("damaged wishlist: reset with a backup copy and a notice", async ({ page }) => {
    await seedStorage(page, { [WISHLIST_KEY]: "{not valid json" });
    await gotoWishlist(page);
    await expect(page.locator('[data-storage-notice="recovered"]')).toContainText(
      "A copy of the damaged data was kept.",
    );
    const backups = await page.evaluate(
      (prefix) =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith(prefix))
          .map((k) => localStorage.getItem(k)),
      `${WISHLIST_KEY}:backup:`,
    );
    expect(backups).toEqual(["{not valid json"]);
  });

  test("wishlist from another version: warns and is never overwritten", async ({ page }) => {
    const foreign = envelope({ items: "future format" }, 99);
    await seedStorage(page, { [WISHLIST_KEY]: foreign });
    await gotoShop(page);
    await heartOf(signatureCard(page)).click();
    await expect(heartAnnouncer(signatureCard(page))).toContainText("for this visit only");
    expect(await readRaw(page, WISHLIST_KEY)).toBe(foreign);
  });

  test("a write that fails mid-visit is never reported as saved", async ({ page }) => {
    await gotoShop(page);
    await page.evaluate((key) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, value: string) {
        if (k === key) throw new DOMException("Quota exceeded", "QuotaExceededError");
        return original.call(this, k, value);
      };
    }, WISHLIST_KEY);
    await heartOf(signatureCard(page)).click();
    await expect(heartAnnouncer(signatureCard(page))).toContainText("for this visit only");
    expect(await readRaw(page, WISHLIST_KEY)).toBeNull();
  });
});

test.describe("Wishlist — layout and SEO", () => {
  test("single-column rows, 44px controls, no overflow", async ({ page }) => {
    await seed(page, {
      wishlist: [
        { productId: SIGNATURE, colourId: C.black },
        { productId: id(4, 2), colourId: null },
        { productId: PINE, colourId: id(2, 4) },
      ],
    });
    await gotoWishlist(page);
    await expect(rows(page)).toHaveCount(3);
    await expectNoHorizontalOverflow(page);
    const boxes = await Promise.all((await rows(page).all()).map((r) => r.boundingBox()));
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i]!.x, "rows share one column").toBeCloseTo(boxes[0]!.x, 0);
      expect(boxes[i]!.y, "rows stack vertically").toBeGreaterThan(
        boxes[i - 1]!.y + boxes[i - 1]!.height - 1,
      );
    }
    const row = rowFor(page, SIGNATURE);
    for (const control of [
      addButton(row),
      removeButton(row),
      row.locator("label").filter({ hasText: /^M$/ }),
    ]) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("hearts are 44px and do not cover card badges or labels", async ({ page }) => {
    await gotoShop(page);
    const card = signatureCard(page);
    const heart = (await heartOf(card).boundingBox())!;
    expect(heart.width).toBeGreaterThanOrEqual(44);
    expect(heart.height).toBeGreaterThanOrEqual(44);
    const intersects = (
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number },
    ) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    for (const other of [card.locator("ul").first(), card.getByText("Demo product")]) {
      if ((await other.count()) === 0) continue;
      expect(intersects(heart, (await other.boundingBox())!)).toBe(false);
    }
    await expectNoHorizontalOverflow(page);
  });

  test("is noindex, titled 'Wishlist', not in the sitemap, no order requests", async ({
    page,
    request,
  }) => {
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET") writes.push(`${r.method()} ${r.url()}`);
    });
    await seed(page, { wishlist: [{ productId: SIGNATURE, colourId: C.black }] });
    await gotoWishlist(page);
    await expect(page).toHaveTitle("Wishlist | JYGS Clothing");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await removeButton(rowFor(page, SIGNATURE)).click();
    await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toBeVisible();
    expect(writes).toEqual([]);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain("/wishlist");
  });
});

test.describe("Wishlist — QA fixes (focus, confirmation, keyboard, loading, storage)", () => {
  const MONOGRAM = id(4, 2);
  const twoRows = [
    { productId: SIGNATURE, colourId: C.black },
    { productId: MONOGRAM, colourId: id(2, 1) }, // Monogram Back Graphic Tee, Black
  ];

  test("keyboard only: choose a size, Add to Bag, then Remove", async ({ page }) => {
    await seed(page, { wishlist: twoRows });
    await gotoWishlist(page);
    const first = rowFor(page, SIGNATURE);
    await rowHeading(first).getByRole("link").focus();
    await page.keyboard.press("Tab"); // into the size radio group (first enabled size)
    await expect(first.getByRole("radio", { name: "XS", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowRight"); // arrow keys move and select within the group
    await expect(first.getByRole("radio", { name: "S", exact: true })).toBeChecked();
    await expect(first.locator("legend")).toContainText("Size: S");
    await page.keyboard.press("Tab");
    await expect(addButton(first)).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(confirmation(page)).toContainText(`Added ${NAME}, Black, S to your bag.`);
    const second = rowFor(page, MONOGRAM);
    await expect(rowHeading(second)).toBeFocused(); // next remaining row
    await removeButton(second).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toBeFocused();
    expect((await storedCart(page)).lines).toEqual([expect.objectContaining({ quantity: 1 })]);
  });

  test("successful Add to Bag with rows remaining: focus moves to the next row; old confirmation clears on the next action", async ({
    page,
  }) => {
    await seed(page, {
      wishlist: [...twoRows, { productId: id(4, 3), colourId: null }],
    });
    await gotoWishlist(page);
    const middle = rowFor(page, MONOGRAM);
    await middle.getByRole("radio", { name: "M", exact: true }).check({ force: true });
    await addButton(middle).click();
    await expect(confirmation(page)).toContainText("to your bag.");
    await expect(rowHeading(rowFor(page, id(4, 3)))).toBeFocused();

    // A new action starts: the previous confirmation disappears.
    await removeButton(rowFor(page, id(4, 3))).click();
    await expect(confirmation(page)).toHaveCount(0);
    await expect(rowHeading(rowFor(page, SIGNATURE))).toBeFocused(); // bottom row → previous
  });

  test("focus does not move while an action is pending, even if the wishlist changes", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await seed(page, { wishlist: [twoRows[0], { productId: MONOGRAM, colourId: null }] });
    await gotoWishlist(page);
    const shop = await context.newPage();
    await gotoShop(shop);
    const holder = await context.newPage();
    await holder.goto("/faq");
    const first = rowFor(page, SIGNATURE);
    await first.getByRole("radio", { name: "M", exact: true }).check({ force: true });
    const release = await holdLock(holder, CART_KEY);

    await addButton(first).click(); // waits for the bag lock
    await expect(addButton(first)).toHaveAttribute("aria-disabled", "true");
    // Another tab changes a DIFFERENT item → this page re-renders while the move is pending.
    const monogramCard = shop
      .locator("main article")
      .filter({ has: shop.getByRole("heading", { name: "Monogram Back Graphic Tee" }) });
    await heartOf(monogramCard).click();
    await expect(rowFor(page, MONOGRAM)).toHaveAttribute("data-item-status", "ok");
    await expect(addButton(first)).toBeFocused(); // not moved early

    await release();
    await expect(confirmation(page)).toContainText(`Added ${NAME}, Black, M to your bag.`);
    await expect(rowHeading(rowFor(page, MONOGRAM))).toBeFocused(); // moved after success
    await shop.close();
    await holder.close();
  });

  test("a failed Add to Bag keeps focus on the button and the row in place", async ({ page }) => {
    await seed(page, {
      wishlist: [{ productId: SIGNATURE, colourId: C.white }],
      cart: cartValue([{ variantId: V.whiteM, quantity: 2 }]), // already at the limit
    });
    await gotoWishlist(page);
    const row = rowFor(page, SIGNATURE);
    await row.getByRole("radio", { name: "M", exact: true }).check({ force: true });
    await addButton(row).click();
    await expect(row.locator("[data-item-message]")).toHaveText(
      "Your bag already has the maximum available in this size.",
    );
    await expect(addButton(row)).toBeFocused();
    await expect(confirmation(page)).toHaveCount(0);
  });

  test("storage write failure during Remove: removed for this visit only, and says so", async ({
    page,
  }) => {
    await seed(page, { wishlist: [twoRows[0]] });
    await gotoWishlist(page);
    const before = await readRaw(page, WISHLIST_KEY);
    await page.evaluate((key) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, value: string) {
        if (k === key) throw new DOMException("Quota exceeded", "QuotaExceededError");
        return original.call(this, k, value);
      };
    }, WISHLIST_KEY);
    await removeButton(rowFor(page, SIGNATURE)).click();
    await expect(announcer(page)).toHaveText(
      `Removed ${NAME}, Black from your wishlist for this visit only — it couldn't be saved in this browser.`,
    );
    await expect(page.locator('[data-storage-notice="memory-only"]')).toBeVisible();
    expect(await readRaw(page, WISHLIST_KEY)).toBe(before); // nothing partial written
  });

  test("a click the moment the heart shows its loaded state still works", async ({ page }) => {
    // Clicks the Signature heart as soon as it switches from "loading" to its real state —
    // the earliest a customer could click a loaded heart. It must act normally.
    await page.addInitScript((name) => {
      const w = window as unknown as { __readyClicked: boolean };
      w.__readyClicked = false;
      new MutationObserver(() => {
        if (w.__readyClicked) return;
        const card = [...document.querySelectorAll("main article")].find((a) =>
          a.querySelector("h3")?.textContent?.includes(name),
        );
        const heart = card?.querySelector<HTMLElement>(
          '[data-wishlist-heart][data-wishlist-state="none"]',
        );
        if (heart && heart.offsetParent !== null) {
          w.__readyClicked = true;
          heart.click();
        }
      }).observe(document, { subtree: true, childList: true, attributes: true });
    }, NAME);
    await page.goto("/shop");
    const card = signatureCard(page);
    await expect(heartOf(card)).toHaveAttribute("data-wishlist-state", "saved");
    expect(
      await page.evaluate(() => (window as unknown as { __readyClicked: boolean }).__readyClicked),
    ).toBe(true);
    expect(await storedItems(page)).toEqual([
      expect.objectContaining({ productId: SIGNATURE, colourId: C.black }),
    ]);
  });

  test("clicks before the wishlist has loaded change nothing", async ({ page }) => {
    // The listing (and its hearts) is streamed hidden and revealed by React; a heart becomes
    // clickable while still showing "loading". A probe clicks each heart twice the moment it is
    // visible in that state. Each probe click is judged by the heart's state AT THE MOMENT THE
    // EVENT ARRIVES (a window capture listener runs before any of the app's handlers):
    // - still "loading" → counted as a loading click and passed on to the app (must be ignored);
    // - already loaded  → the heart became ready in between: the click is stopped before the app
    //   sees it, so the test never acts on a ready heart by accident.
    await page.addInitScript(() => {
      const w = window as unknown as {
        __probing: boolean;
        __loadingClicks: number;
        __blockedReadyClicks: number;
      };
      w.__probing = false;
      w.__loadingClicks = 0;
      w.__blockedReadyClicks = 0;
      window.addEventListener(
        "click",
        (event) => {
          if (!w.__probing) return; // only judge the probe's own clicks
          const heart = (event.target as Element | null)?.closest<HTMLElement>(
            "[data-wishlist-heart]",
          );
          if (heart?.dataset.wishlistState === "loading") {
            w.__loadingClicks += 1;
          } else {
            w.__blockedReadyClicks += 1;
            event.stopImmediatePropagation();
            event.preventDefault();
          }
        },
        true,
      );
      const clicked = new WeakSet<Element>();
      new MutationObserver(() => {
        for (const el of document.querySelectorAll<HTMLElement>(
          '[data-wishlist-heart][data-wishlist-state="loading"]',
        )) {
          if (clicked.has(el) || el.offsetParent === null) continue; // not visible yet
          clicked.add(el);
          w.__probing = true;
          try {
            el.click();
            el.click();
          } finally {
            w.__probing = false;
          }
        }
      }).observe(document, { subtree: true, childList: true, attributes: true });
    });
    await page.goto("/shop");
    const heart = heartOf(signatureCard(page));
    await expect(heart).toHaveAttribute("data-wishlist-state", "none", { timeout: 20_000 });
    await page.waitForTimeout(500); // give any delayed handling time to (not) act

    const counts = await page.evaluate(() => {
      const w = window as unknown as { __loadingClicks: number; __blockedReadyClicks: number };
      return { loading: w.__loadingClicks, blocked: w.__blockedReadyClicks };
    });
    // Meaningful: real clicks reached the app while the hearts were still loading.
    expect(counts.loading, "clicks that arrived while a heart was loading").toBeGreaterThan(0);
    expect(await readRaw(page, WISHLIST_KEY)).toBeNull();
    await expect(page.locator('[data-wishlist-heart][data-wishlist-state="saved"]')).toHaveCount(0);
    await expect(heart).toHaveAttribute("data-wishlist-state", "none");
    await expect(heart).toHaveAccessibleName(LABEL.none("Black"));

    // A click that arrives after the heart is ready works normally.
    await heart.click();
    await expect(heart).toHaveAttribute("data-wishlist-state", "saved");
    expect(await storedItems(page)).toEqual([
      expect.objectContaining({ productId: SIGNATURE, colourId: C.black }),
    ]);
  });
});
