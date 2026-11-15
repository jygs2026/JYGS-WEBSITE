import { describe, expect, it } from "vitest";

import {
  clearPendingMove,
  countItems,
  emptyWishlist,
  findItem,
  referencedOperationIds,
  removeFromWishlist,
  saveToWishlist,
  setPendingMove,
  toggleWishlist,
} from "./wishlist-model";
import { validateWishlistData } from "./wishlist-schema";

const t1 = new Date("2026-11-14T10:00:00.000Z");
const t2 = new Date("2026-11-14T11:00:00.000Z");
const move = (opId: string) => ({
  opId,
  variantId: "v",
  owner: "tab-1",
  startedAt: t1.toISOString(),
  leaseExpiresAt: t2.toISOString(),
});

describe("wishlist model", () => {
  it("adds a product with its colour", () => {
    const s = saveToWishlist(emptyWishlist(), "p1", "black", t1);
    expect(s.items).toEqual([{ productId: "p1", colourId: "black", addedAt: t1.toISOString() }]);
  });

  it("one entry per product: saving again updates the remembered colour, keeps addedAt", () => {
    const first = saveToWishlist(emptyWishlist(), "p1", "black", t1);
    const second = saveToWishlist(first, "p1", "white", t2);
    expect(countItems(second)).toBe(1);
    expect(findItem(second, "p1")).toEqual({
      productId: "p1",
      colourId: "white",
      addedAt: t1.toISOString(),
    });
    expect(saveToWishlist(second, "p1", "white", t2)).toBe(second); // no-op when unchanged
  });

  it("removes and toggles", () => {
    const s = saveToWishlist(emptyWishlist(), "p1", null, t1);
    expect(removeFromWishlist(s, "p1").items).toEqual([]);
    expect(removeFromWishlist(s, "nope")).toBe(s);
    const on = toggleWishlist(emptyWishlist(), "p2", "plum", t1);
    expect(on.saved).toBe(true);
    const off = toggleWishlist(on.state, "p2", "plum", t1);
    expect(off.saved).toBe(false);
    expect(off.state.items).toEqual([]);
  });

  it("sets and clears pending moves (only the matching opId) and lists referenced ops", () => {
    let s = saveToWishlist(emptyWishlist(), "p1", null, t1);
    s = setPendingMove(s, "p1", move("op-1"));
    expect(referencedOperationIds(s)).toEqual(new Set(["op-1"]));
    expect(clearPendingMove(s, "p1", "other")).toBe(s);
    const cleared = clearPendingMove(s, "p1", "op-1");
    expect(findItem(cleared, "p1")?.pendingMove).toBeUndefined();
    expect(setPendingMove(emptyWishlist(), "missing", move("x")).items).toEqual([]);
  });
});

describe("validateWishlistData", () => {
  const at = t1.toISOString();

  it("keeps valid items, drops invalid ones, de-duplicates by product", () => {
    const result = validateWishlistData({
      items: [
        { productId: "p1", colourId: "c1", addedAt: at },
        { productId: "p1", colourId: "c2", addedAt: at },
        { productId: "p2", colourId: null, addedAt: at, pendingMove: move("op-9") },
        { productId: "", colourId: null, addedAt: at },
        { productId: "p3", colourId: 5, addedAt: at },
        { productId: "p4", colourId: null, addedAt: "never" },
        "junk",
      ],
    });
    expect(result?.data.items.map((i) => i.productId)).toEqual(["p1", "p2"]);
    expect(result?.data.items[0].colourId).toBe("c1");
    expect(result?.data.items[1].pendingMove?.opId).toBe("op-9");
    expect(result?.dropped).toBe(4);
  });

  it("drops a malformed pendingMove but keeps the item", () => {
    const result = validateWishlistData({
      items: [{ productId: "p1", colourId: null, addedAt: at, pendingMove: { opId: 1 } }],
    });
    expect(result?.data.items).toEqual([{ productId: "p1", colourId: null, addedAt: at }]);
  });

  it("returns null for an unrecognised shape", () => {
    expect(validateWishlistData({ lines: [] })).toBeNull();
    expect(validateWishlistData(null)).toBeNull();
  });
});
