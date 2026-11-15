/**
 * Cart repository + storage integration (M3.3 cart page actions): every change runs under the
 * cross-tab lock on a FRESH read, so newer data from another tab is never overwritten.
 */
import { describe, expect, it } from "vitest";

import { createShoppingSession } from "@/lib/shopping/session";
import {
  createInTabLockManager,
  LockTimeoutError,
  type LockManager,
} from "@/lib/storage/cross-tab-lock";
import { MemoryStorageAdapter } from "@/lib/storage/memory-storage-adapter";
import { ChangeHub, clock, createTab, FakeStorage } from "@/test-utils/fake-storage";
import type { CartState } from "@/types";

import type { VariantAvailability } from "./cart-model";
import { CART_STORAGE_KEY } from "./cart-schema";

const P = "product-signature";
const v = (variantId: string, available = 15): VariantAvailability => ({
  variantId,
  productId: P,
  available,
  isActive: true,
});
const BLACK_M = v("black-m");
const BLACK_L = v("black-l");
const WHITE_M = v("white-m", 2);

const exclusiveLocks = (): LockManager => ({ ...createInTabLockManager(), exclusive: true });
const sharedLocks = exclusiveLocks();

const envelope = (data: unknown, version = 1) =>
  JSON.stringify({ v: version, rev: 1, updatedAt: "2026-11-14T09:00:00.000Z", data });
const cartOf = (s: FakeStorage) => {
  const raw = s.peek(CART_STORAGE_KEY);
  return raw ? (JSON.parse(raw).data as CartState) : null;
};
const quantities = (s: FakeStorage) =>
  Object.fromEntries((cartOf(s)?.lines ?? []).map((l) => [l.variantId, l.quantity]));

function tab(storage: FakeStorage, hub: ChangeHub, locks: LockManager = sharedLocks) {
  return createShoppingSession({
    adapter: createTab(storage, hub),
    locks,
    now: clock().now,
    createId: (() => {
      let n = 0;
      return () => `id-${++n}`;
    })(),
  });
}

/**
 * Two tabs over one shared storage. By default both are subscribed (as the open cart page and
 * header are), so each follows the other's writes; `subscribed: false` leaves their in-memory
 * snapshots stale, to prove writes are always based on a fresh read.
 */
function twoTabs(initial?: Record<string, string>, { subscribed = true } = {}) {
  const storage = new FakeStorage(initial);
  const hub = new ChangeHub();
  const a = tab(storage, hub);
  const b = tab(storage, hub);
  if (subscribed) {
    a.cart.subscribe(() => {});
    b.cart.subscribe(() => {});
  }
  return { storage, a, b };
}

describe("cart page actions persist and sync across tabs", () => {
  it("setQuantity / remove / clear are saved and seen by the other tab", async () => {
    const { storage, a, b } = twoTabs();
    await a.cart.add(BLACK_M, 1);
    await a.cart.add(BLACK_L, 1);

    expect(await b.cart.setQuantity("black-m", 4, BLACK_M)).toMatchObject({
      ok: true,
      quantity: 4,
    });
    expect(quantities(storage)).toEqual({ "black-m": 4, "black-l": 1 });
    expect(a.cart.getSnapshot().data.lines.find((l) => l.variantId === "black-m")?.quantity).toBe(
      4,
    );

    expect(await a.cart.remove("black-l")).toEqual({ ok: true });
    expect(b.cart.getSnapshot().data.lines.map((l) => l.variantId)).toEqual(["black-m"]);

    expect(await b.cart.clear()).toEqual({ ok: true });
    expect(cartOf(storage)?.lines).toEqual([]);
    expect(a.cart.getSnapshot().data.lines).toEqual([]);
  });

  it("a stale tab never overwrites newer data: changes apply to a fresh read", async () => {
    const { storage, a, b } = twoTabs(undefined, { subscribed: false });
    await a.cart.add(BLACK_M, 1);
    await b.cart.add(BLACK_L, 2); // newer data written by B; A's snapshot does not know about it
    expect(a.cart.getSnapshot().data.lines.map((l) => l.variantId)).toEqual(["black-m"]);
    // A changes black-m based on its stale view — B's newer line must survive.
    await a.cart.setQuantity("black-m", 3, BLACK_M);
    expect(quantities(storage)).toEqual({ "black-m": 3, "black-l": 2 });
    // A removes black-m — B's line still survives.
    await a.cart.remove("black-m");
    expect(quantities(storage)).toEqual({ "black-l": 2 });
  });

  it("concurrent changes from two tabs are serialised by the lock (no lost update)", async () => {
    const { storage, a, b } = twoTabs();
    await a.cart.add(BLACK_M, 1);
    await Promise.all([
      a.cart.setQuantity("black-m", 2, BLACK_M),
      b.cart.add(BLACK_L, 1),
      a.cart.add(BLACK_L, 1),
    ]);
    expect(quantities(storage)).toEqual({ "black-m": 2, "black-l": 2 });
  });

  it("refuses quantities above the limit and below 1 without writing", async () => {
    const { storage, a } = twoTabs();
    await a.cart.add(WHITE_M, 1);
    const writes = storage.writeLog.length;
    expect(await a.cart.setQuantity("white-m", 3, WHITE_M)).toMatchObject({
      ok: false,
      reason: "limit_reached",
      limit: 2,
    });
    expect(await a.cart.setQuantity("white-m", 0, WHITE_M)).toMatchObject({
      ok: false,
      reason: "invalid_quantity",
    });
    expect(storage.writeLog.length).toBe(writes);
    expect(quantities(storage)).toEqual({ "white-m": 1 });
  });

  it("acknowledging reduced stock saves the shown quantity; sold-out lines are never removed", async () => {
    const line = (variantId: string, quantity: number) => ({
      variantId,
      productId: P,
      quantity,
      addedAt: "2026-11-14T09:00:00.000Z",
    });
    const { storage, a } = twoTabs({
      [CART_STORAGE_KEY]: envelope({ lines: [line("white-m", 5), line("sold-out", 1)], ops: [] }),
    });
    expect(await a.cart.acknowledgeAvailability("white-m", WHITE_M)).toMatchObject({
      ok: true,
      quantity: 2,
    });
    expect(await a.cart.acknowledgeAvailability("sold-out", v("sold-out", 0))).toMatchObject({
      ok: false,
      reason: "sold_out",
    });
    expect(await a.cart.setQuantity("gone", 1, null)).toMatchObject({ ok: false });
    expect(quantities(storage)).toEqual({ "white-m": 2, "sold-out": 1 });
  });

  it("clear keeps the wishlist → bag operation journal", async () => {
    const ops = [
      { opId: "op-done", variantId: "black-m", completed: true, at: "2026-11-14T09:00:00.000Z" },
      { opId: "op-open", variantId: "black-l", completed: false, at: "2026-11-14T09:00:00.000Z" },
    ];
    const { storage, a } = twoTabs({
      [CART_STORAGE_KEY]: envelope({
        lines: [
          { variantId: "black-m", productId: P, quantity: 1, addedAt: "2026-11-14T09:00:00.000Z" },
        ],
        ops,
      }),
    });
    expect(await a.cart.clear()).toEqual({ ok: true });
    const saved = cartOf(storage)!;
    expect(saved.lines).toEqual([]);
    expect(saved.ops.map((o) => o.opId)).toEqual(expect.arrayContaining(["op-done", "op-open"]));
  });
});

describe("failures are reported, never shown as success", () => {
  it("a failed write is never reported as saved: the bag continues for this visit only", async () => {
    // M3.1 rule (unchanged): when browser storage refuses a write, the change is kept in memory
    // for this visit and the store reports `persistent: false` / "memory-only". The cart page
    // reads `persistent` after every action, so its message says "for this visit only".
    const { storage, a } = twoTabs();
    await a.cart.add(BLACK_M, 2);
    const before = storage.peek(CART_STORAGE_KEY);
    storage.failSetItem = (key) => key === CART_STORAGE_KEY;

    expect(await a.cart.setQuantity("black-m", 3, BLACK_M)).toMatchObject({ ok: true });
    expect(a.cart.getSnapshot()).toMatchObject({ persistent: false, status: "memory-only" });
    expect(storage.peek(CART_STORAGE_KEY)).toBe(before); // nothing partial or corrupt written
    expect(await a.cart.remove("black-m")).toEqual({ ok: true });
    expect(a.cart.getSnapshot().persistent).toBe(false);
    expect(storage.peek(CART_STORAGE_KEY)).toBe(before);
  });

  it("a lock that can't be acquired (busy tab) reports lock_timeout and writes nothing", async () => {
    const storage = new FakeStorage();
    const hub = new ChangeHub();
    await tab(storage, hub).cart.add(BLACK_M, 1);
    const before = storage.peek(CART_STORAGE_KEY);
    const busy: LockManager = {
      exclusive: true,
      run: (name) => Promise.reject(new LockTimeoutError(name)),
    };
    const a = tab(storage, hub, busy);
    expect(await a.cart.setQuantity("black-m", 2, BLACK_M)).toEqual({
      ok: false,
      reason: "lock_timeout",
    });
    expect(await a.cart.remove("black-m")).toEqual({ ok: false, reason: "lock_timeout" });
    expect(await a.cart.clear()).toEqual({ ok: false, reason: "lock_timeout" });
    expect(storage.peek(CART_STORAGE_KEY)).toBe(before);
  });

  it("a bag from another version is never overwritten by any cart page action", async () => {
    const foreign = envelope({ lines: "future format" }, 99);
    const { storage, a } = twoTabs({ [CART_STORAGE_KEY]: foreign });
    await a.cart.add(BLACK_M, 1);
    await a.cart.setQuantity("black-m", 2, BLACK_M);
    await a.cart.remove("black-m");
    await a.cart.add(BLACK_L, 1);
    await a.cart.clear();
    expect(storage.peek(CART_STORAGE_KEY)).toBe(foreign);
    expect(a.cart.getSnapshot().status).toBe("foreign-version");
  });

  it("memory-only mode works for the visit but persists nothing", async () => {
    const session = createShoppingSession({
      adapter: new MemoryStorageAdapter(),
      locks: exclusiveLocks(),
    });
    await session.cart.add(BLACK_M, 1);
    await session.cart.setQuantity("black-m", 3, BLACK_M);
    expect(session.cart.getSnapshot()).toMatchObject({ status: "memory-only" });
    expect(session.cart.getSnapshot().data.lines[0].quantity).toBe(3);
  });
});
