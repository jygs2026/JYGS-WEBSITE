/**
 * M3.4 heart / guarded Remove: the pure rules (applyHeart, applyRemove) and the safe sequence
 * (interrupted moves recovered first, then a write that applies only if nothing changed).
 */
import { describe, expect, it } from "vitest";

import type { VariantAvailability } from "@/lib/cart/cart-model";
import { CART_STORAGE_KEY } from "@/lib/cart/cart-schema";
import { createShoppingSession, type ShoppingSession } from "@/lib/shopping/session";
import {
  createInTabLockManager,
  LockTimeoutError,
  type LockManager,
} from "@/lib/storage/cross-tab-lock";
import { ChangeHub, clock, createTab, FakeStorage } from "@/test-utils/fake-storage";
import type { CartState, PendingMove, WishlistState } from "@/types";

import { applyHeart, applyRemove, emptyWishlist, saveToWishlist } from "./wishlist-model";
import { WISHLIST_STORAGE_KEY } from "./wishlist-schema";

const P = "product-signature";
const AT = "2026-11-14T09:00:00.000Z";
const now = new Date("2026-11-14T10:00:00.000Z");
const blackM: VariantAvailability = {
  variantId: "black-m",
  productId: P,
  available: 18,
  isActive: true,
};

describe("applyHeart (pure rules)", () => {
  const saved = (colourId: string | null) => ({
    items: [{ productId: P, colourId, addedAt: AT }],
  });

  it("not saved → saves in the card's colour", () => {
    const r = applyHeart(emptyWishlist(), P, "white", { saved: false }, now);
    expect(r.outcome).toEqual({ kind: "saved", colourId: "white" });
    expect(r.state.items).toEqual([
      { productId: P, colourId: "white", addedAt: now.toISOString() },
    ]);
  });

  it("saved in the same colour → removes", () => {
    const r = applyHeart(saved("white"), P, "white", { saved: true, colourId: "white" }, now);
    expect(r.outcome).toEqual({ kind: "removed" });
    expect(r.state.items).toEqual([]);
  });

  it("saved in another colour → changes the colour, keeps the date, never duplicates", () => {
    const r = applyHeart(saved("black"), P, "white", { saved: true, colourId: "black" }, now);
    expect(r.outcome).toEqual({ kind: "colour-changed", from: "black", to: "white" });
    expect(r.state.items).toEqual([{ productId: P, colourId: "white", addedAt: AT }]);
  });

  it("saved without a colour → sets the colour", () => {
    const r = applyHeart(saved(null), P, "white", { saved: true, colourId: null }, now);
    expect(r.outcome).toEqual({ kind: "colour-changed", from: null, to: "white" });
    expect(r.state.items).toHaveLength(1);
  });

  it("does nothing when the item no longer matches what the heart showed", () => {
    const state = saved("black");
    expect(applyHeart(state, P, "white", { saved: false }, now)).toEqual({
      state,
      outcome: { kind: "changed-elsewhere" },
    });
    expect(applyHeart(state, P, "black", { saved: true, colourId: "white" }, now).outcome).toEqual({
      kind: "changed-elsewhere",
    });
    expect(
      applyHeart(emptyWishlist(), P, "white", { saved: true, colourId: "white" }, now).outcome,
    ).toEqual({ kind: "changed-elsewhere" });
  });

  it("never touches an item that is part of a move", () => {
    const move: PendingMove = {
      opId: "op-1",
      variantId: "black-m",
      owner: "tab-1",
      startedAt: AT,
      leaseExpiresAt: AT,
    };
    const state: WishlistState = {
      items: [{ productId: P, colourId: "black", addedAt: AT, pendingMove: move }],
    };
    const r = applyHeart(state, P, "black", { saved: true, colourId: "black" }, now);
    expect(r).toEqual({ state, outcome: { kind: "move-pending" } });
    expect(applyRemove(state, P, { colourId: "black" })).toEqual({
      state,
      outcome: { kind: "move-pending" },
    });
  });

  it("never mutates its input; at most one entry per product", () => {
    let state = saveToWishlist(emptyWishlist(), P, "black", now);
    const frozen = JSON.stringify(state);
    for (const colour of ["white", "off-white", "black"]) {
      const item = state.items[0];
      state = applyHeart(state, P, colour, { saved: true, colourId: item.colourId }, now).state;
      expect(state.items.filter((i) => i.productId === P)).toHaveLength(1);
    }
    expect(JSON.stringify(saveToWishlist(emptyWishlist(), P, "black", now))).toBe(frozen);
  });

  it("applyRemove: removes only a matching item", () => {
    expect(applyRemove(saved("black"), P, { colourId: "black" }).outcome).toEqual({
      kind: "removed",
    });
    expect(applyRemove(saved("white"), P, { colourId: "black" }).outcome).toEqual({
      kind: "changed-elsewhere",
    });
    expect(applyRemove(emptyWishlist(), P, { colourId: "black" }).outcome).toEqual({
      kind: "changed-elsewhere",
    });
  });
});

// --- Safe sequence over real sessions --------------------------------------------------------

const exclusiveLocks = (): LockManager => ({ ...createInTabLockManager(), exclusive: true });
const envelope = (data: unknown) => JSON.stringify({ v: 1, rev: 1, updatedAt: AT, data });
const wishlistOf = (s: FakeStorage) =>
  (JSON.parse(s.peek(WISHLIST_STORAGE_KEY) ?? "null")?.data as WishlistState | undefined) ?? null;
const cartOf = (s: FakeStorage) =>
  (JSON.parse(s.peek(CART_STORAGE_KEY) ?? "null")?.data as CartState | undefined) ?? null;
const tick = () => new Promise((r) => setTimeout(r, 5));

function marker(owner: string, leaseExpiresAt: string, opId = "op-1"): PendingMove {
  return { opId, variantId: "black-m", owner, startedAt: AT, leaseExpiresAt };
}

function setup(options: {
  wishlist?: WishlistState;
  cart?: CartState;
  locks?: () => LockManager;
  clockAt?: string;
}) {
  const storage = new FakeStorage({
    ...(options.wishlist ? { [WISHLIST_STORAGE_KEY]: envelope(options.wishlist) } : {}),
    ...(options.cart ? { [CART_STORAGE_KEY]: envelope(options.cart) } : {}),
  });
  const hub = new ChangeHub();
  const shared = exclusiveLocks();
  const time = clock(options.clockAt ?? "2026-11-14T10:00:00.000Z");
  let n = 0;
  const tab = (locks: LockManager): ShoppingSession =>
    createShoppingSession({
      adapter: createTab(storage, hub),
      locks,
      now: time.now,
      createId: () => `id-${++n}`,
    });
  const make = options.locks ?? (() => shared);
  return { storage, hub, shared, a: tab(make()), b: tab(make()), time };
}

const savedBlack = (extra: Partial<WishlistState["items"][number]> = {}): WishlistState => ({
  items: [{ productId: P, colourId: "black", addedAt: AT, ...extra }],
});
const cartWith = (opCompleted: boolean | null): CartState => ({
  lines:
    opCompleted === null ? [] : [{ variantId: "black-m", productId: P, quantity: 1, addedAt: AT }],
  ops:
    opCompleted === null
      ? []
      : [{ opId: "op-1", variantId: "black-m", completed: opCompleted, at: AT }],
});

describe("safe heart / Remove: pending moves (Web Locks)", () => {
  it("an ACTIVE move holding both locks: the heart waits, then sees the change and does nothing", async () => {
    const { storage, shared, a, b } = setup({ wishlist: savedBlack() });
    let release!: () => void;
    const held = shared.run(CART_STORAGE_KEY, () =>
      shared.run(WISHLIST_STORAGE_KEY, () => new Promise<void>((r) => (release = r))),
    );
    await tick();
    const heart = b.heart(P, "black", { saved: true, colourId: "black" });
    let settled = false;
    void heart.then(() => (settled = true));
    await tick();
    expect(settled).toBe(false); // waiting for the move's locks

    // The move completes: added to the bag, removed from the wishlist.
    a.cart.store.mutateNow((s) => ({
      data: { ...s, lines: [{ variantId: "black-m", productId: P, quantity: 1, addedAt: AT }] },
      result: undefined,
    }));
    a.wishlist.store.mutateNow(() => ({ data: { items: [] }, result: undefined }));
    release();
    await held;

    expect(await heart).toEqual({ ok: true, outcome: { kind: "changed-elsewhere" } });
    expect(wishlistOf(storage)?.items).toEqual([]); // not re-added
    expect(cartOf(storage)?.lines.map((l) => l.quantity)).toEqual([1]); // exactly one
  });

  it("an active move whose marker is visible: recovery waits for it and adds nothing", async () => {
    const { storage, shared, a, b } = setup({
      wishlist: savedBlack({ pendingMove: marker("tab-a", "2026-11-14T10:00:15.000Z") }),
    });
    let release!: () => void;
    const held = shared.run(CART_STORAGE_KEY, () =>
      shared.run(WISHLIST_STORAGE_KEY, () => new Promise<void>((r) => (release = r))),
    );
    await tick();
    const remove = b.safeRemove(P, { colourId: "black" });
    await tick();
    a.cart.store.mutateNow(() => ({ data: cartWith(false), result: undefined }));
    a.wishlist.store.mutateNow(() => ({ data: { items: [] }, result: undefined }));
    release();
    await held;
    expect(await remove).toEqual({ ok: true, outcome: { kind: "changed-elsewhere" } });
    expect(cartOf(storage)?.lines.map((l) => l.quantity)).toEqual([1]);
  });

  it("concurrent real move + heart: always consistent, never a duplicate", async () => {
    for (let round = 0; round < 5; round++) {
      const { storage, a, b } = setup({ wishlist: savedBlack() });
      await Promise.all([
        a.moveToCart(P, blackM),
        b.heart(P, "black", { saved: true, colourId: "black" }),
      ]);
      const units = cartOf(storage)?.lines.reduce((n, l) => n + l.quantity, 0) ?? 0;
      expect(units).toBeLessThanOrEqual(1);
      expect(wishlistOf(storage)?.items.some((i) => i.pendingMove) ?? false).toBe(false);
      expect(cartOf(storage)?.ops.every((o) => o.completed) ?? true).toBe(true);
    }
  });

  it("interrupted move whose add reached the bag: recovered, item removed, bag unchanged", async () => {
    const { storage, b } = setup({
      wishlist: savedBlack({ pendingMove: marker("tab-gone", "2026-11-14T09:00:15.000Z") }),
      cart: cartWith(false),
    });
    expect(await b.heart(P, "white", { saved: true, colourId: "black" })).toEqual({
      ok: true,
      outcome: { kind: "already-moved" },
    });
    expect(wishlistOf(storage)?.items).toEqual([]);
    expect(cartOf(storage)?.lines).toEqual([expect.objectContaining({ quantity: 1 })]);
    expect(cartOf(storage)?.ops[0].completed).toBe(true);
  });

  it("interrupted move whose add never happened: marker cleared, then the heart applies", async () => {
    const { storage, b } = setup({
      wishlist: savedBlack({ pendingMove: marker("tab-gone", "2026-11-14T09:00:15.000Z") }),
    });
    expect(await b.heart(P, "white", { saved: true, colourId: "black" })).toEqual({
      ok: true,
      outcome: { kind: "colour-changed", from: "black", to: "white" },
    });
    expect(wishlistOf(storage)?.items).toEqual([{ productId: P, colourId: "white", addedAt: AT }]);
    expect(cartOf(storage)?.lines ?? []).toEqual([]);
  });

  it("safeRemove recovers first too", async () => {
    const { storage, b } = setup({
      wishlist: savedBlack({ pendingMove: marker("tab-gone", "2026-11-14T09:00:15.000Z") }),
      cart: cartWith(false),
    });
    expect(await b.safeRemove(P, { colourId: "black" })).toEqual({
      ok: true,
      outcome: { kind: "already-moved" },
    });
    expect(cartOf(storage)?.lines.map((l) => l.quantity)).toEqual([1]);
  });
});

describe("safe heart / Remove: no-Web-Locks fallback (in-tab locks only)", () => {
  const inTab = () => createInTabLockManager(); // exclusive: false

  it("another tab's move with a valid lease → refused, nothing changes", async () => {
    const wishlist = savedBlack({ pendingMove: marker("tab-other", "2026-11-14T10:00:15.000Z") });
    const { storage, b } = setup({ wishlist, locks: inTab });
    const before = storage.peek(WISHLIST_STORAGE_KEY);
    expect(await b.heart(P, "black", { saved: true, colourId: "black" })).toEqual({
      ok: true,
      outcome: { kind: "move-in-progress" },
    });
    expect(await b.safeRemove(P, { colourId: "black" })).toEqual({
      ok: true,
      outcome: { kind: "move-in-progress" },
    });
    expect(storage.peek(WISHLIST_STORAGE_KEY)).toBe(before);
    expect(storage.peek(CART_STORAGE_KEY)).toBeNull();
  });

  it("an expired lease is an interrupted move → recovered, then applied", async () => {
    const wishlist = savedBlack({ pendingMove: marker("tab-other", "2026-11-14T09:59:00.000Z") });
    const { storage, b } = setup({ wishlist, locks: inTab });
    expect(await b.heart(P, "black", { saved: true, colourId: "black" })).toEqual({
      ok: true,
      outcome: { kind: "removed" },
    });
    expect(wishlistOf(storage)?.items).toEqual([]);
    expect(cartOf(storage)?.lines ?? []).toEqual([]);
  });

  it("a marker owned by this tab is recovered (same-tab moves are serialised)", async () => {
    const { storage, b } = setup({ wishlist: savedBlack(), locks: inTab });
    storage.seed(
      WISHLIST_STORAGE_KEY,
      envelope(savedBlack({ pendingMove: marker(b.tabId, "2026-11-14T10:00:15.000Z") })),
    );
    expect(await b.safeRemove(P, { colourId: "black" })).toEqual({
      ok: true,
      outcome: { kind: "removed" },
    });
    expect(wishlistOf(storage)?.items).toEqual([]);
  });
});

describe("safe heart / Remove: failures and stale tabs", () => {
  it("recovery that cannot save → failure, never success, nothing else changes", async () => {
    const { storage, b } = setup({
      wishlist: savedBlack({ pendingMove: marker("tab-gone", "2026-11-14T09:00:15.000Z") }),
      cart: cartWith(false),
    });
    storage.failSetItem = (key) => key === WISHLIST_STORAGE_KEY;
    expect(await b.heart(P, "black", { saved: true, colourId: "black" })).toEqual({
      ok: false,
      reason: "storage_error",
    });
    expect(cartOf(storage)?.lines.map((l) => l.quantity)).toEqual([1]);
    expect(wishlistOf(storage)?.items[0].pendingMove?.opId).toBe("op-1");
  });

  it("a busy lock → lock_timeout and no write", async () => {
    const busy: LockManager = {
      exclusive: true,
      run: (name) => Promise.reject(new LockTimeoutError(name)),
    };
    const { storage, b } = setup({ wishlist: savedBlack(), locks: () => busy });
    const before = storage.peek(WISHLIST_STORAGE_KEY);
    expect(await b.heart(P, "black", { saved: true, colourId: "black" })).toEqual({
      ok: false,
      reason: "lock_timeout",
    });
    expect(storage.peek(WISHLIST_STORAGE_KEY)).toBe(before);
  });

  it("a stale tab never overwrites newer data from another tab", async () => {
    const { storage, a, b } = setup({ wishlist: savedBlack() });
    await a.heart(P, "white", { saved: true, colourId: "black" }); // A changes the colour
    // B still shows "saved in Black" and clicks it (meaning: remove).
    expect(await b.heart(P, "black", { saved: true, colourId: "black" })).toEqual({
      ok: true,
      outcome: { kind: "changed-elsewhere" },
    });
    expect(wishlistOf(storage)?.items).toEqual([{ productId: P, colourId: "white", addedAt: AT }]);
  });

  it("the existing M3.1 toggle is unchanged (removes regardless of colour)", async () => {
    const { storage, b } = setup({ wishlist: savedBlack() });
    expect(await b.wishlist.toggle(P, "white")).toEqual({ ok: true, saved: false });
    expect(wishlistOf(storage)?.items).toEqual([]);
  });
});

describe("safeRemove: lock timeout and failed recovery (QA P2-2)", () => {
  const busy: LockManager = {
    exclusive: true,
    run: (name) => Promise.reject(new LockTimeoutError(name)),
  };
  const bagUnits = (s: FakeStorage) => cartOf(s)?.lines.reduce((n, l) => n + l.quantity, 0) ?? 0;

  it("lock timeout during Remove (no marker): lock_timeout, item and storage unchanged", async () => {
    const { storage, b } = setup({ wishlist: savedBlack(), locks: () => busy });
    const before = storage.peek(WISHLIST_STORAGE_KEY);
    expect(await b.safeRemove(P, { colourId: "black" })).toEqual({
      ok: false,
      reason: "lock_timeout",
    });
    expect(storage.peek(WISHLIST_STORAGE_KEY)).toBe(before);
    expect(storage.peek(CART_STORAGE_KEY)).toBeNull();
  });

  it("lock timeout during Remove's recovery (pending move): item, marker and bag unchanged", async () => {
    const { storage, b } = setup({
      wishlist: savedBlack({ pendingMove: marker("tab-gone", "2026-11-14T09:00:15.000Z") }),
      cart: cartWith(false),
      locks: () => busy,
    });
    const wishlistBefore = storage.peek(WISHLIST_STORAGE_KEY);
    const cartBefore = storage.peek(CART_STORAGE_KEY);
    expect(await b.safeRemove(P, { colourId: "black" })).toEqual({
      ok: false,
      reason: "lock_timeout",
    });
    expect(storage.peek(WISHLIST_STORAGE_KEY)).toBe(wishlistBefore);
    expect(storage.peek(CART_STORAGE_KEY)).toBe(cartBefore);
    expect(bagUnits(storage)).toBe(1);
  });

  it("failed recovery during Remove (add in the bag, wishlist write fails): item kept, bag never grows", async () => {
    const { storage, b } = setup({
      wishlist: savedBlack({ pendingMove: marker("tab-gone", "2026-11-14T09:00:15.000Z") }),
      cart: cartWith(false),
    });
    const wishlistBefore = storage.peek(WISHLIST_STORAGE_KEY);
    storage.failSetItem = (key) => key === WISHLIST_STORAGE_KEY;
    expect(await b.safeRemove(P, { colourId: "black" })).toEqual({
      ok: false,
      reason: "storage_error",
    });
    expect(storage.peek(WISHLIST_STORAGE_KEY)).toBe(wishlistBefore); // item + marker kept
    expect(bagUnits(storage)).toBe(1);
  });

  it("failed recovery during Remove (add never happened, marker can't be cleared): item kept, bag empty", async () => {
    const { storage, b } = setup({
      wishlist: savedBlack({ pendingMove: marker("tab-gone", "2026-11-14T09:00:15.000Z") }),
    });
    const wishlistBefore = storage.peek(WISHLIST_STORAGE_KEY);
    storage.failSetItem = (key) => key === WISHLIST_STORAGE_KEY;
    expect(await b.safeRemove(P, { colourId: "black" })).toEqual({
      ok: false,
      reason: "storage_error",
    });
    expect(storage.peek(WISHLIST_STORAGE_KEY)).toBe(wishlistBefore);
    expect(bagUnits(storage)).toBe(0);
  });

  it("after the failure clears, the same Remove succeeds once and the bag stays at 1", async () => {
    const { storage, b } = setup({
      wishlist: savedBlack({ pendingMove: marker("tab-gone", "2026-11-14T09:00:15.000Z") }),
      cart: cartWith(false),
    });
    storage.failSetItem = (key) => key === WISHLIST_STORAGE_KEY;
    await b.safeRemove(P, { colourId: "black" });
    storage.failSetItem = null;
    expect(await b.safeRemove(P, { colourId: "black" })).toEqual({
      ok: true,
      outcome: { kind: "already-moved" },
    });
    expect(wishlistOf(storage)?.items).toEqual([]);
    expect(bagUnits(storage)).toBe(1);
  });
});
