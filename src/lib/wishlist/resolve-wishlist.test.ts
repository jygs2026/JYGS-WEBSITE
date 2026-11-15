import { describe, expect, it } from "vitest";

import { indexCatalog } from "@/lib/cart/resolve-cart";
import { getCartCatalog } from "@/services/catalog";
import type { WishlistItem } from "@/types";

import { resolveWishlist, resolveWishlistItem, savedColourName } from "./resolve-wishlist";

const AT = "2026-11-14T09:00:00.000Z";

async function fixture() {
  const catalog = await getCartCatalog();
  const index = indexCatalog(catalog);
  const bySlug = (slug: string) => catalog.products.find((p) => p.slug === slug)!;
  const colourId = (slug: string, colour: string) =>
    bySlug(slug).variants.find((v) => v.colourSlug === colour)!.colourId;
  return { catalog, index, bySlug, colourId };
}

const item = (productId: string, colourId: string | null, extra: Partial<WishlistItem> = {}) => ({
  productId,
  colourId,
  addedAt: AT,
  ...extra,
});

describe("resolveWishlist", () => {
  it("ok: the saved colour with its sizes, demo stock, image and CURRENT price", async () => {
    const { index, bySlug, colourId } = await fixture();
    const signature = bySlug("signature-oversized-tee");
    const r = resolveWishlistItem(
      item(signature.id, colourId("signature-oversized-tee", "white")),
      index,
    );
    expect(r.status).toBe("ok");
    expect(r.colour).toMatchObject({ name: "White", slug: "white" });
    expect(r.price).toBe(149_900);
    expect(r.image?.url).toMatch(/white-front/);
    expect(r.sizes.map((s) => [s.label, s.available])).toEqual([
      ["XS", 0],
      ["S", 0],
      ["M", 2],
      ["L", 15],
      ["XL", 9],
    ]);
  });

  it("no colour saved: status no_colour, no sizes, never another colour", async () => {
    const { index, bySlug } = await fixture();
    const r = resolveWishlistItem(item(bySlug("signature-oversized-tee").id, null), index);
    expect(r.status).toBe("no_colour");
    expect(r.colour).toBeNull();
    expect(r.sizes).toEqual([]);
    expect(r.product?.slug).toBe("signature-oversized-tee");
  });

  it("saved colour not offered: status colour_unavailable, never substituted", async () => {
    const { index, bySlug, colourId } = await fixture();
    const signature = bySlug("signature-oversized-tee");
    const cherry = colourId("cherry-repeat-logo-tee", "cherry"); // Signature has no Cherry
    const r = resolveWishlistItem(item(signature.id, cherry), index);
    expect(r.status).toBe("colour_unavailable");
    expect(r.colour).toBeNull();
    expect(r.sizes).toEqual([]);
  });

  it("saved colour inactive: also colour_unavailable (name still known)", async () => {
    const { catalog, bySlug, colourId } = await fixture();
    const signature = bySlug("signature-oversized-tee");
    const white = colourId("signature-oversized-tee", "white");
    const inactive = {
      products: catalog.products.map((p) =>
        p.id !== signature.id
          ? p
          : {
              ...p,
              variants: p.variants.map((v) =>
                v.colourId === white ? { ...v, isActive: false } : v,
              ),
            },
      ),
    };
    const index = indexCatalog(inactive);
    const saved = item(signature.id, white);
    expect(resolveWishlistItem(saved, index).status).toBe("colour_unavailable");
    expect(savedColourName(saved, index)).toBe("White");
  });

  it("sold out in the saved colour", async () => {
    const { index, bySlug, colourId } = await fixture();
    const pine = bySlug("pine-monogram-oversized-tee");
    const r = resolveWishlistItem(
      item(pine.id, colourId("pine-monogram-oversized-tee", "pine-green")),
      index,
    );
    expect(r.status).toBe("sold_out");
    expect(r.sizes.every((s) => s.available === 0)).toBe(true);
  });

  it("product no longer in the catalogue", async () => {
    const { index } = await fixture();
    const r = resolveWishlistItem(item("00000000-0000-4000-8004-999999999999", "x"), index);
    expect(r).toMatchObject({ status: "unavailable", product: null, colour: null, price: 0 });
  });

  it("flags items with a move marker and keeps order", async () => {
    const { index, bySlug, colourId } = await fixture();
    const signature = bySlug("signature-oversized-tee");
    const black = colourId("signature-oversized-tee", "black");
    const pendingMove = {
      opId: "op-1",
      variantId: "v",
      owner: "tab",
      startedAt: AT,
      leaseExpiresAt: AT,
    };
    const list = resolveWishlist(
      {
        items: [
          item(signature.id, black, { pendingMove }),
          item(bySlug("plum-orbit-boxy-tee").id, null),
        ],
      },
      index,
    );
    expect(list.map((r) => [r.status, r.pendingMove])).toEqual([
      ["ok", true],
      ["no_colour", false],
    ]);
  });

  it("ignores any price-like data in storage", async () => {
    const { index, bySlug, colourId } = await fixture();
    const signature = bySlug("signature-oversized-tee");
    const tampered = {
      ...item(signature.id, colourId("signature-oversized-tee", "black")),
      price: 1,
    };
    expect(resolveWishlistItem(tampered as WishlistItem, index).price).toBe(149_900);
  });
});
