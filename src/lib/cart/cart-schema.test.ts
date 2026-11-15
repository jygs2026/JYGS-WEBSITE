import { describe, expect, it } from "vitest";

import { readStore } from "@/lib/storage/versioned-store";
import { WebStorageAdapter } from "@/lib/storage/web-storage-adapter";
import { clock, FakeStorage } from "@/test-utils/fake-storage";

import { CART_STORAGE_KEY, cartSchema, validateCartData } from "./cart-schema";

const at = "2026-11-14T10:00:00.000Z";
const line = (variantId: string, quantity: number, extra: Record<string, unknown> = {}) => ({
  variantId,
  productId: "p1",
  quantity,
  addedAt: at,
  ...extra,
});

describe("validateCartData", () => {
  it("accepts valid lines and journal entries", () => {
    const result = validateCartData({
      lines: [line("a", 2)],
      ops: [{ opId: "op1", variantId: "a", completed: false, at }],
    });
    expect(result).toEqual({
      data: { lines: [line("a", 2)], ops: [{ opId: "op1", variantId: "a", completed: false, at }] },
      dropped: 0,
    });
  });

  it("drops wrong types, negative / fractional / oversized quantities and bad IDs", () => {
    const result = validateCartData({
      lines: [
        line("ok", 1),
        line("neg", -1),
        line("frac", 1.5),
        line("zero", 0),
        line("huge", 5000),
        line("str", "2" as unknown as number),
        { productId: "p1", quantity: 1, addedAt: at },
        line("", 1),
        line("baddate", 1, { addedAt: "not a date" }),
        null,
        "junk",
      ],
    });
    expect(result?.data.lines.map((l) => l.variantId)).toEqual(["ok"]);
    expect(result?.dropped).toBe(10);
  });

  it("merges duplicate variants (sum, earliest addedAt)", () => {
    const result = validateCartData({
      lines: [
        line("a", 2, { addedAt: "2026-11-14T12:00:00.000Z" }),
        line("a", 3, { addedAt: "2026-11-14T09:00:00.000Z" }),
      ],
    });
    expect(result?.data.lines).toEqual([line("a", 5, { addedAt: "2026-11-14T09:00:00.000Z" })]);
  });

  it("ignores malformed journal entries silently", () => {
    const result = validateCartData({
      lines: [],
      ops: [{ opId: 1 }, "x", { opId: "ok", variantId: "v", completed: true, at }],
    });
    expect(result?.data.ops.map((o) => o.opId)).toEqual(["ok"]);
    expect(result?.dropped).toBe(0);
  });

  it("returns null (unrecognised → preserved) for the wrong overall shape", () => {
    expect(validateCartData(null)).toBeNull();
    expect(validateCartData([])).toBeNull();
    expect(validateCartData({ items: [] })).toBeNull();
    expect(validateCartData({ lines: [], ops: "nope" })).toBeNull();
  });
});

describe("cart schema with the versioned store", () => {
  const { now } = clock();

  it("round-trips through the envelope", () => {
    const storage = new FakeStorage({
      [CART_STORAGE_KEY]: JSON.stringify({
        v: 1,
        rev: 2,
        updatedAt: at,
        data: { lines: [line("a", 1)], ops: [] },
      }),
    });
    expect(readStore(new WebStorageAdapter(storage), cartSchema, now)).toMatchObject({
      status: "ok",
      rev: 2,
      data: { lines: [line("a", 1)] },
    });
  });

  it("preserves a future-version cart untouched", () => {
    const raw = JSON.stringify({ v: 2, rev: 1, updatedAt: at, data: { lines: [] } });
    const storage = new FakeStorage({ [CART_STORAGE_KEY]: raw });
    expect(readStore(new WebStorageAdapter(storage), cartSchema, now).status).toBe(
      "foreign-version",
    );
    expect(storage.peek(CART_STORAGE_KEY)).toBe(raw);
  });
});
