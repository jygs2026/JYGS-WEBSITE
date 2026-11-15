import { describe, expect, it } from "vitest";

import {
  acknowledgeAvailability,
  addToCart,
  clearCart,
  completeOperation,
  countUnits,
  emptyCart,
  hasOperation,
  lineLimit,
  MAX_COMPLETED_OPERATIONS,
  normaliseOperations,
  removeLine,
  setLineQuantity,
  type VariantAvailability,
} from "./cart-model";

const now = new Date("2026-11-14T10:00:00.000Z");
const v = (id: string, available = 20, isActive = true): VariantAvailability => ({
  variantId: id,
  productId: "p1",
  available,
  isActive,
});
const blackM = v("black-m");
const blackL = v("black-l");
const whiteM = v("white-m", 2); // low demo stock

describe("addToCart", () => {
  it("adds a new line", () => {
    const { state, change } = addToCart(emptyCart(), blackM, 1, now);
    expect(change).toEqual({ ok: true, quantity: 1, limit: 10 });
    expect(state.lines).toEqual([
      { variantId: "black-m", productId: "p1", quantity: 1, addedAt: now.toISOString() },
    ]);
  });

  it("same variant increases quantity instead of duplicating", () => {
    const once = addToCart(emptyCart(), blackM, 1, now).state;
    const twice = addToCart(once, blackM, 1, now);
    expect(twice.state.lines).toHaveLength(1);
    expect(twice.state.lines[0].quantity).toBe(2);
  });

  it("different size or colour creates separate lines", () => {
    let s = addToCart(emptyCart(), blackM, 1, now).state;
    s = addToCart(s, blackL, 1, now).state; // different size
    s = addToCart(s, whiteM, 1, now).state; // different colour
    expect(s.lines.map((l) => l.variantId)).toEqual(["black-m", "black-l", "white-m"]);
  });

  it("enforces the 10-per-line maximum (no partial add)", () => {
    const nine = addToCart(emptyCart(), blackM, 9, now).state;
    const ten = addToCart(nine, blackM, 1, now);
    expect(ten.change).toMatchObject({ ok: true, quantity: 10 });
    const eleven = addToCart(ten.state, blackM, 1, now);
    expect(eleven.change).toEqual({ ok: false, reason: "limit_reached", quantity: 10, limit: 10 });
    expect(eleven.state).toBe(ten.state);
    expect(addToCart(nine, blackM, 2, now).change).toMatchObject({
      ok: false,
      reason: "limit_reached",
    });
  });

  it("enforces available demo stock when below 10", () => {
    const two = addToCart(addToCart(emptyCart(), whiteM, 1, now).state, whiteM, 1, now);
    expect(two.change).toMatchObject({ ok: true, quantity: 2, limit: 2 });
    expect(addToCart(two.state, whiteM, 1, now).change).toMatchObject({
      ok: false,
      reason: "limit_reached",
      limit: 2,
    });
  });

  it("refuses sold-out, inactive and unknown variants and invalid quantities", () => {
    expect(addToCart(emptyCart(), v("x", 0), 1, now).change).toMatchObject({
      ok: false,
      reason: "sold_out",
    });
    expect(addToCart(emptyCart(), v("x", 5, false), 1, now).change).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
    expect(addToCart(emptyCart(), null, 1, now).change).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
    for (const q of [0, -1, 1.5, Number.NaN]) {
      expect(addToCart(emptyCart(), blackM, q, now).change).toMatchObject({
        ok: false,
        reason: "invalid_quantity",
      });
    }
  });

  it("records an unfinished journal entry when given an opId", () => {
    const { state } = addToCart(emptyCart(), blackM, 1, now, "op-1");
    expect(state.ops).toEqual([
      { opId: "op-1", variantId: "black-m", completed: false, at: now.toISOString() },
    ]);
    expect(hasOperation(state, "op-1")).toBe(true);
  });

  it("never mutates its input", () => {
    const start = emptyCart();
    const frozen = JSON.stringify(start);
    addToCart(start, blackM, 1, now, "op");
    expect(JSON.stringify(start)).toBe(frozen);
  });
});

describe("quantity, remove, clear, count", () => {
  const base = addToCart(addToCart(emptyCart(), blackM, 3, now).state, whiteM, 1, now).state;

  it("increases and decreases within 1…limit", () => {
    expect(setLineQuantity(base, "black-m", 4, blackM).state.lines[0].quantity).toBe(4);
    expect(setLineQuantity(base, "black-m", 1, blackM).state.lines[0].quantity).toBe(1);
    expect(setLineQuantity(base, "black-m", 0, blackM).change).toMatchObject({
      ok: false,
      reason: "invalid_quantity",
    });
    expect(setLineQuantity(base, "black-m", 11, blackM).change).toMatchObject({
      ok: false,
      reason: "limit_reached",
    });
    expect(setLineQuantity(base, "white-m", 3, whiteM).change).toMatchObject({
      ok: false,
      reason: "limit_reached",
      limit: 2,
    });
    expect(setLineQuantity(base, "missing", 1, blackM).change).toMatchObject({
      ok: false,
      reason: "not_in_cart",
    });
  });

  it("removes a line and clears the cart (journal kept)", () => {
    const withOp = addToCart(base, blackL, 1, now, "op-x").state;
    expect(removeLine(withOp, "black-m").lines.map((l) => l.variantId)).toEqual([
      "white-m",
      "black-l",
    ]);
    expect(removeLine(withOp, "nope")).toBe(withOp);
    const cleared = clearCart(withOp);
    expect(cleared.lines).toEqual([]);
    expect(cleared.ops).toHaveLength(1);
  });

  it("counts units", () => {
    expect(countUnits(base)).toBe(4);
    expect(countUnits(emptyCart())).toBe(0);
  });

  it("lineLimit = min(10, demo stock), 0 when unavailable", () => {
    expect(lineLimit(blackM)).toBe(10);
    expect(lineLimit(whiteM)).toBe(2);
    expect(lineLimit(v("x", 0))).toBe(0);
    expect(lineLimit(v("x", 5, false))).toBe(0);
    expect(lineLimit(null)).toBe(0);
  });
});

describe("acknowledgeAvailability (reduced stock is never applied silently)", () => {
  const over = {
    lines: [{ variantId: "white-m", productId: "p1", quantity: 5, addedAt: now.toISOString() }],
    ops: [],
  };

  it("saves the reduced quantity only when called (customer confirmation)", () => {
    const { state, change } = acknowledgeAvailability(over, "white-m", whiteM);
    expect(state.lines[0].quantity).toBe(2);
    expect(change).toMatchObject({ ok: true, quantity: 2 });
  });

  it("never removes sold-out or unavailable lines", () => {
    expect(acknowledgeAvailability(over, "white-m", v("white-m", 0)).state).toBe(over);
    expect(acknowledgeAvailability(over, "white-m", null).state).toBe(over);
  });
});

describe("operation journal housekeeping", () => {
  const op = (id: string, completed: boolean, minute: number) => ({
    opId: id,
    variantId: "v",
    completed,
    at: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
  });

  it("completes unfinished entries no longer referenced (only when references are known)", () => {
    const state = { lines: [], ops: [op("a", false, 1), op("b", false, 2)] };
    const next = normaliseOperations(state, new Set(["b"]));
    expect(next.ops.find((o) => o.opId === "a")?.completed).toBe(true);
    expect(next.ops.find((o) => o.opId === "b")?.completed).toBe(false);
    expect(normaliseOperations(state, null)).toBe(state); // unknown references → keep all unfinished
  });

  it("caps completed entries at 50 but never prunes an unfinished entry", () => {
    const ops = [
      ...Array.from({ length: 60 }, (_, i) => op(`done-${i}`, true, i)),
      op("pending", false, 0),
    ];
    const next = normaliseOperations({ lines: [], ops }, new Set(["pending"]));
    expect(next.ops.filter((o) => o.completed)).toHaveLength(MAX_COMPLETED_OPERATIONS);
    expect(next.ops.some((o) => o.opId === "pending" && !o.completed)).toBe(true);
    expect(next.ops.some((o) => o.opId === "done-59")).toBe(true); // newest kept
    expect(next.ops.some((o) => o.opId === "done-0")).toBe(false); // oldest pruned
  });

  it("completeOperation marks one entry", () => {
    const s = { lines: [], ops: [op("a", false, 1)] };
    expect(completeOperation(s, "a").ops[0].completed).toBe(true);
    expect(completeOperation(s, "zzz")).toBe(s);
  });
});
