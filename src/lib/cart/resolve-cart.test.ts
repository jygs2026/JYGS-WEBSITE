import { describe, expect, it } from "vitest";

import { getCartCatalog } from "@/services/catalog";
import type { CartState } from "@/types";

import { acknowledgeAvailability, addToCart, emptyCart } from "./cart-model";
import { createVariantLookup, indexCatalog, resolveCart } from "./resolve-cart";

const at = "2026-11-14T10:00:00.000Z";
const now = new Date(at);

async function fixture() {
  const catalog = await getCartCatalog();
  const index = indexCatalog(catalog);
  const signature = catalog.products.find((p) => p.slug === "signature-oversized-tee")!;
  const variant = (colour: string, size: string) =>
    signature.variants.find((v) => v.colourSlug === colour && v.size === size)!;
  return { catalog, index, lookup: createVariantLookup(index), signature, variant };
}

describe("getCartCatalog", () => {
  it("exposes only published products with IDs, prices and demo stock (no XXL)", async () => {
    const { catalog } = await fixture();
    expect(catalog.products.length).toBe(10);
    expect(catalog.products.some((p) => p.slug === "studio-sample-tee")).toBe(false);
    const sizes = new Set(catalog.products.flatMap((p) => p.variants.map((v) => v.size)));
    expect([...sizes].sort()).toEqual(["L", "M", "S", "XL", "XS"]);
  });
});

describe("resolveCart", () => {
  it("computes line totals and subtotal from CURRENT catalogue prices", async () => {
    const { index, lookup, variant } = await fixture();
    let s = addToCart(emptyCart(), lookup(variant("black", "M").id), 2, now).state;
    s = addToCart(s, lookup(variant("off-white", "L").id), 1, now).state;
    const cart = resolveCart(s, index);
    expect(cart.lines.map((l) => [l.status, l.quantity, l.unitPrice, l.lineTotal])).toEqual([
      ["ok", 2, 149_900, 299_800],
      ["ok", 1, 149_900, 149_900],
    ]);
    expect(cart.subtotal).toBe(449_700);
    expect(cart.units).toBe(3);
  });

  it("ignores any price-like data that might be present in storage", async () => {
    const { index, variant, signature } = await fixture();
    const tampered = {
      lines: [
        {
          variantId: variant("black", "M").id,
          productId: signature.id,
          quantity: 1,
          addedAt: at,
          price: 1,
        },
      ],
      ops: [],
    } as unknown as CartState;
    expect(resolveCart(tampered, index).subtotal).toBe(149_900);
  });

  it("marks missing products/variants unavailable — excluded, never substituted", async () => {
    const { index, signature } = await fixture();
    const state: CartState = {
      lines: [
        { variantId: "gone-variant", productId: signature.id, quantity: 2, addedAt: at },
        { variantId: "x", productId: "gone-product", quantity: 1, addedAt: at },
      ],
      ops: [],
    };
    const cart = resolveCart(state, index);
    expect(cart.lines.map((l) => l.status)).toEqual(["unavailable", "unavailable"]);
    expect(cart.lines[0].product?.id).toBe(signature.id); // product still shown for context
    expect(cart.subtotal).toBe(0);
    expect(cart.unavailableCount).toBe(2);
    expect(cart.storedUnits).toBe(3);
  });

  it("variant/product mismatch is unavailable (no cross-product substitution)", async () => {
    const { index, variant } = await fixture();
    const state: CartState = {
      lines: [
        {
          variantId: variant("black", "M").id,
          productId: "another-product",
          quantity: 1,
          addedAt: at,
        },
      ],
      ops: [],
    };
    expect(resolveCart(state, index).lines[0].status).toBe("unavailable");
  });

  it("stock reduction is DISPLAYED with an explanation; storage stays unchanged until acknowledged", async () => {
    const { index, lookup, variant, signature } = await fixture();
    const whiteM = variant("white", "M"); // demo stock 2
    const stored: CartState = {
      lines: [{ variantId: whiteM.id, productId: signature.id, quantity: 5, addedAt: at }],
      ops: [],
    };
    const cart = resolveCart(stored, index);
    expect(cart.lines[0]).toMatchObject({
      status: "adjusted",
      quantity: 2,
      lineTotal: 2 * whiteM.price,
      adjustment: { from: 5, to: 2, reason: "stock" },
    });
    expect(cart.adjustedCount).toBe(1);
    expect(stored.lines[0].quantity).toBe(5); // resolving never changes the stored cart

    const acknowledged = acknowledgeAvailability(stored, whiteM.id, lookup(whiteM.id)).state;
    expect(resolveCart(acknowledged, index).lines[0]).toMatchObject({ status: "ok", quantity: 2 });
  });

  it("quantities above the 10 maximum are shown as 10 with reason 'max'", async () => {
    const { index, variant, signature } = await fixture();
    const blackM = variant("black", "M"); // demo stock 18
    const cart = resolveCart(
      {
        lines: [{ variantId: blackM.id, productId: signature.id, quantity: 12, addedAt: at }],
        ops: [],
      },
      index,
    );
    expect(cart.lines[0]).toMatchObject({
      status: "adjusted",
      quantity: 10,
      adjustment: { from: 12, to: 10, reason: "max" },
    });
  });

  it("sold-out lines are kept, excluded from the subtotal, never removed", async () => {
    const { index, catalog } = await fixture();
    const pine = catalog.products.find((p) => p.slug === "pine-monogram-oversized-tee")!;
    const sold = pine.variants[0];
    const cart = resolveCart(
      { lines: [{ variantId: sold.id, productId: pine.id, quantity: 1, addedAt: at }], ops: [] },
      index,
    );
    expect(cart.lines[0]).toMatchObject({ status: "sold_out", quantity: 0, lineTotal: 0 });
    expect(cart.lines).toHaveLength(1);
  });

  it("uses the colourway's front image", async () => {
    const { index, lookup, variant } = await fixture();
    const s = addToCart(emptyCart(), lookup(variant("white", "L").id), 1, now).state;
    expect(resolveCart(s, index).lines[0].image?.url).toBe("/demo/tees/tee-white-front.svg");
  });
});

describe("cart page totals (M3.3)", () => {
  const line = (variantId: string, productId: string, quantity: number) => ({
    variantId,
    productId,
    quantity,
    addedAt: at,
  });

  it("an empty bag has subtotal 0 and no units", async () => {
    const { index } = await fixture();
    expect(resolveCart(emptyCart(), index)).toMatchObject({
      lines: [],
      subtotal: 0,
      units: 0,
      storedUnits: 0,
      adjustedCount: 0,
      unavailableCount: 0,
    });
  });

  it("mixed bag: adjusted lines count at the shown quantity, sold-out/unavailable count 0", async () => {
    const { index, variant, signature } = await fixture();
    const state: CartState = {
      lines: [
        line(variant("black", "M").id, signature.id, 2), // ok
        line(variant("white", "M").id, signature.id, 5), // adjusted → 2 (demo stock 2)
        line(variant("white", "XS").id, signature.id, 1), // sold out
        line("00000000-0000-4000-8006-999999999999", signature.id, 3), // unavailable
      ],
      ops: [],
    };
    const cart = resolveCart(state, index);
    expect(cart.lines.map((l) => [l.status, l.quantity, l.lineTotal])).toEqual([
      ["ok", 2, 299_800],
      ["adjusted", 2, 299_800],
      ["sold_out", 0, 0],
      ["unavailable", 0, 0],
    ]);
    expect(cart.subtotal).toBe(599_600);
    expect(Number.isInteger(cart.subtotal)).toBe(true);
    expect(cart.units).toBe(4); // counted (shown)
    expect(cart.storedUnits).toBe(11); // saved — what the header badge shows until acknowledged
    expect(cart.adjustedCount).toBe(1);
    expect(cart.unavailableCount).toBe(2);
    // Displayed values never leak into the stored state.
    expect(state.lines.map((l) => l.quantity)).toEqual([2, 5, 1, 3]);
  });

  it("subtotal stays exact integer paise with prices that include paise", async () => {
    const { catalog, variant, signature } = await fixture();
    const priced = {
      products: catalog.products.map((p) =>
        p.id !== signature.id
          ? p
          : { ...p, variants: p.variants.map((v) => ({ ...v, price: 149_950 })) },
      ),
    };
    const state: CartState = {
      lines: [
        line(variant("black", "M").id, signature.id, 3),
        line(variant("black", "L").id, signature.id, 7),
      ],
      ops: [],
    };
    const cart = resolveCart(state, indexCatalog(priced));
    expect(cart.subtotal).toBe(1_499_500);
    expect(Number.isInteger(cart.subtotal)).toBe(true);
  });

  it("quantity changes stay within 1…limit; acknowledging saves the shown quantity", async () => {
    const { index, lookup, variant, signature } = await fixture();
    const whiteM = variant("white", "M");
    const state: CartState = { lines: [line(whiteM.id, signature.id, 5)], ops: [] };
    expect(resolveCart(state, index).lines[0].limit).toBe(2);
    const acknowledged = acknowledgeAvailability(state, whiteM.id, lookup(whiteM.id));
    expect(acknowledged.change).toMatchObject({ ok: true, quantity: 2 });
    expect(resolveCart(acknowledged.state, index)).toMatchObject({ units: 2, storedUnits: 2 });
  });
});
