import { describe, expect, it } from "vitest";

import type { VariantAvailability } from "@/lib/cart/cart-model";
import { CART_STORAGE_KEY } from "@/lib/cart/cart-schema";
import { IdGenerationError } from "@/lib/create-id";
import { createShoppingSession, type SessionOptions } from "@/lib/shopping/session";
import {
  createInTabLockManager,
  LockTimeoutError,
  type LockManager,
} from "@/lib/storage/cross-tab-lock";
import { ChangeHub, clock, createTab, FakeStorage } from "@/test-utils/fake-storage";
import type { CartState, WishlistState } from "@/types";

import { WISHLIST_STORAGE_KEY } from "./wishlist-schema";

const P = "product-signature";
const whiteL: VariantAvailability = {
  variantId: "white-l",
  productId: P,
  available: 15,
  isActive: true,
};
const lowStock: VariantAvailability = {
  variantId: "white-m",
  productId: P,
  available: 1,
  isActive: true,
};

/** Shared exclusive locks simulate the Web Locks API across tabs. */
const exclusiveLocks = (): LockManager => ({ ...createInTabLockManager(), exclusive: true });

let idCounter = 0;
const ids = () => `op-${++idCounter}`;

function readJson<T>(storage: FakeStorage, key: string): T | null {
  const raw = storage.peek(key);
  return raw ? (JSON.parse(raw).data as T) : null;
}
const cartOf = (s: FakeStorage) => readJson<CartState>(s, CART_STORAGE_KEY);
const wishlistOf = (s: FakeStorage) => readJson<WishlistState>(s, WISHLIST_STORAGE_KEY);
const envelope = (data: unknown) =>
  JSON.stringify({ v: 1, rev: 1, updatedAt: "2026-11-14T09:00:00.000Z", data });

function tab(storage: FakeStorage, hub: ChangeHub, options: Partial<SessionOptions> = {}) {
  return createShoppingSession({
    adapter: createTab(storage, hub),
    locks: options.locks ?? exclusiveLocks(),
    createId: options.createId ?? ids,
    now: options.now ?? clock().now,
    leaseMs: options.leaseMs,
    lockTimeoutMs: options.lockTimeoutMs,
  });
}

async function withSavedItem(options: Partial<SessionOptions> = {}) {
  const storage = new FakeStorage();
  const hub = new ChangeHub();
  const session = tab(storage, hub, options);
  await session.wishlist.save(P, "white");
  return { storage, hub, session };
}

describe("Wishlist → Cart move: success and simple failures", () => {
  it("moves: adds once, removes from wishlist, completes the journal entry", async () => {
    const { storage, session } = await withSavedItem();
    expect(await session.moveToCart(P, whiteL)).toEqual({
      status: "moved",
      finishedPrevious: false,
    });
    expect(cartOf(storage)?.lines).toEqual([
      expect.objectContaining({ variantId: "white-l", quantity: 1 }),
    ]);
    expect(cartOf(storage)?.ops).toEqual([expect.objectContaining({ completed: true })]);
    expect(wishlistOf(storage)?.items).toEqual([]);
  });

  it("refuses when the line is at its limit — item kept, no marker", async () => {
    const { storage, session } = await withSavedItem();
    await session.cart.add(lowStock); // 1 of 1 available already in cart
    expect(await session.moveToCart(P, lowStock)).toEqual({
      status: "failed",
      reason: "limit_reached",
    });
    expect(wishlistOf(storage)?.items).toEqual([expect.objectContaining({ productId: P })]);
    expect(wishlistOf(storage)?.items[0].pendingMove).toBeUndefined();
    expect(cartOf(storage)?.lines[0].quantity).toBe(1);
  });

  it("refuses an unavailable / unselected variant", async () => {
    const { storage, session } = await withSavedItem();
    expect(await session.moveToCart(P, null)).toEqual({ status: "failed", reason: "unavailable" });
    expect(wishlistOf(storage)?.items).toHaveLength(1);
  });

  it("reports already-moved when the item is no longer in the wishlist", async () => {
    const { session } = await withSavedItem();
    await session.wishlist.remove(P);
    expect(await session.moveToCart(P, whiteL)).toEqual({ status: "already-moved" });
  });
});

describe("partial failures (both steps must succeed to report a move)", () => {
  it("step 1 (marker) write fails → nothing changes", async () => {
    const { storage, session } = await withSavedItem();
    storage.failSetItem = (k) => k === WISHLIST_STORAGE_KEY;
    expect(await session.moveToCart(P, whiteL)).toEqual({
      status: "failed",
      reason: "storage_error",
    });
    expect(cartOf(storage)).toBeNull();
    expect(wishlistOf(storage)?.items).toHaveLength(1);
  });

  it("step 2 (cart) write fails → item kept, marker cleared, cart unchanged", async () => {
    const { storage, session } = await withSavedItem();
    storage.failSetItem = (k) => k === CART_STORAGE_KEY;
    expect(await session.moveToCart(P, whiteL)).toEqual({
      status: "failed",
      reason: "storage_error",
    });
    expect(cartOf(storage)).toBeNull();
    expect(wishlistOf(storage)?.items[0]).toMatchObject({ productId: P });
    expect(wishlistOf(storage)?.items[0].pendingMove).toBeUndefined();
  });

  it("step 3 (wishlist removal) fails → partial; retries never add twice; finish completes it", async () => {
    const { storage, session } = await withSavedItem();
    let wishlistWrites = 0;
    storage.failSetItem = (k) => k === WISHLIST_STORAGE_KEY && ++wishlistWrites > 1; // marker ok, removal fails

    expect(await session.moveToCart(P, whiteL)).toEqual({ status: "partial" });
    expect(cartOf(storage)?.lines[0].quantity).toBe(1);
    expect(wishlistOf(storage)?.items[0].pendingMove).toBeDefined();

    // Retry while storage is still failing: still partial, cart quantity unchanged.
    expect(await session.moveToCart(P, whiteL)).toEqual({ status: "partial" });
    expect(cartOf(storage)?.lines[0].quantity).toBe(1);

    // Storage recovers: finishing removes the item without adding again.
    storage.failSetItem = null;
    expect(await session.finishMove(P)).toEqual({ status: "moved", finishedPrevious: true });
    expect(cartOf(storage)?.lines[0].quantity).toBe(1);
    expect(wishlistOf(storage)?.items).toEqual([]);
  });

  it("ID generation failure → nothing written, item kept, no crash", async () => {
    const storage = new FakeStorage();
    const hub = new ChangeHub();
    const session = tab(storage, hub, {
      createId: () => {
        throw new IdGenerationError();
      },
    });
    expect(session.tabId).toMatch(/^tab-/); // tab ID falls back safely
    await session.wishlist.save(P, "white");
    const writesBefore = storage.writeLog.length;
    expect(await session.moveToCart(P, whiteL)).toEqual({
      status: "failed",
      reason: "id_generation",
    });
    expect(storage.writeLog.length).toBe(writesBefore);
    expect(wishlistOf(storage)?.items).toHaveLength(1);
  });

  it("lock timeout → failed, nothing changed", async () => {
    const timingOut: LockManager = {
      exclusive: true,
      run: async (name) => {
        throw new LockTimeoutError(name);
      },
    };
    const storage = new FakeStorage({
      [WISHLIST_STORAGE_KEY]: envelope({
        items: [{ productId: P, colourId: null, addedAt: "2026-11-14T09:00:00.000Z" }],
      }),
    });
    const session = tab(storage, new ChangeHub(), { locks: timingOut });
    expect(await session.moveToCart(P, whiteL)).toEqual({
      status: "failed",
      reason: "lock_timeout",
    });
    expect(cartOf(storage)).toBeNull();
  });

  it("acquires locks in the fixed order cart → wishlist", async () => {
    const base = exclusiveLocks();
    const order: string[] = [];
    const recording: LockManager = {
      exclusive: true,
      run: (name, fn, options) => {
        order.push(name);
        return base.run(name, fn, options);
      },
    };
    const { session } = await withSavedItem({ locks: recording });
    order.length = 0;
    await session.moveToCart(P, whiteL);
    expect(order).toEqual([CART_STORAGE_KEY, WISHLIST_STORAGE_KEY]);
  });
});

describe("cross-tab coordination", () => {
  it("two tabs moving the same item at once → exactly one cart add", async () => {
    const storage = new FakeStorage();
    const hub = new ChangeHub();
    const locks = exclusiveLocks(); // one manager shared = Web Locks across tabs
    const tabA = tab(storage, hub, { locks });
    const tabB = tab(storage, hub, { locks });
    await tabA.wishlist.save(P, "white");

    const results = await Promise.all([tabA.moveToCart(P, whiteL), tabB.moveToCart(P, whiteL)]);
    expect(results.map((r) => r.status).sort()).toEqual(["already-moved", "moved"]);
    expect(cartOf(storage)?.lines).toEqual([expect.objectContaining({ quantity: 1 })]);
    expect(wishlistOf(storage)?.items).toEqual([]);
  });

  it("with locks, a found pendingMove is an interrupted move: add happened → only finish removal", async () => {
    const storage = new FakeStorage({
      [CART_STORAGE_KEY]: envelope({
        lines: [
          { variantId: "white-l", productId: P, quantity: 1, addedAt: "2026-11-14T09:00:00.000Z" },
        ],
        ops: [
          {
            opId: "crashed-op",
            variantId: "white-l",
            completed: false,
            at: "2026-11-14T09:00:00.000Z",
          },
        ],
      }),
      [WISHLIST_STORAGE_KEY]: envelope({
        items: [
          {
            productId: P,
            colourId: "white",
            addedAt: "2026-11-14T08:00:00.000Z",
            pendingMove: {
              opId: "crashed-op",
              variantId: "white-l",
              owner: "tab-other",
              startedAt: "2026-11-14T09:59:59.000Z",
              leaseExpiresAt: "2026-11-14T10:10:00.000Z", // not expired — irrelevant with locks
            },
          },
        ],
      }),
    });
    const session = tab(storage, new ChangeHub());
    expect(await session.moveToCart(P, whiteL)).toEqual({
      status: "moved",
      finishedPrevious: true,
    });
    expect(cartOf(storage)?.lines[0].quantity).toBe(1); // never doubled
    expect(wishlistOf(storage)?.items).toEqual([]);
  });

  it("pendingMove whose add never happened → marker cleared, fresh move proceeds", async () => {
    const storage = new FakeStorage({
      [WISHLIST_STORAGE_KEY]: envelope({
        items: [
          {
            productId: P,
            colourId: "white",
            addedAt: "2026-11-14T08:00:00.000Z",
            pendingMove: {
              opId: "never-added",
              variantId: "white-l",
              owner: "tab-other",
              startedAt: "2026-11-14T09:00:00.000Z",
              leaseExpiresAt: "2026-11-14T09:00:15.000Z",
            },
          },
        ],
      }),
    });
    const session = tab(storage, new ChangeHub());
    expect(await session.moveToCart(P, whiteL)).toEqual({
      status: "moved",
      finishedPrevious: false,
    });
    expect(cartOf(storage)?.lines[0].quantity).toBe(1);
  });

  it("without Web Locks: an unexpired lease from another tab is in progress; expired is recovered", async () => {
    const c = clock("2026-11-14T10:00:00.000Z");
    const seeded = envelope({
      items: [
        {
          productId: P,
          colourId: "white",
          addedAt: "2026-11-14T08:00:00.000Z",
          pendingMove: {
            opId: "other-op",
            variantId: "white-l",
            owner: "tab-other",
            startedAt: "2026-11-14T09:59:55.000Z",
            leaseExpiresAt: "2026-11-14T10:00:10.000Z",
          },
        },
      ],
    });
    const storage = new FakeStorage({ [WISHLIST_STORAGE_KEY]: seeded });
    const session = tab(storage, new ChangeHub(), { locks: createInTabLockManager(), now: c.now });

    expect(await session.moveToCart(P, whiteL)).toEqual({ status: "in-progress" });
    expect(storage.peek(WISHLIST_STORAGE_KEY)).toBe(seeded); // untouched
    expect(cartOf(storage)).toBeNull();

    c.advance(15_000); // lease expired → treated as failed; its add never happened
    expect(await session.moveToCart(P, whiteL)).toEqual({
      status: "moved",
      finishedPrevious: false,
    });
    expect(cartOf(storage)?.lines[0].quantity).toBe(1);
  });

  it("without Web Locks: write-then-verify detects a competing claim", async () => {
    const { storage, session } = await withSavedItem({ locks: createInTabLockManager() });
    // Simulate another tab overwriting our marker right after we write it.
    storage.onSet = (key, value) => {
      if (key !== WISHLIST_STORAGE_KEY) return;
      const parsed = JSON.parse(value);
      const item = parsed.data.items[0];
      if (item?.pendingMove && item.pendingMove.owner !== "tab-rival") {
        storage.onSet = null;
        item.pendingMove = { ...item.pendingMove, opId: "rival-op", owner: "tab-rival" };
        storage.seed(key, JSON.stringify(parsed));
      }
    };
    expect(await session.moveToCart(P, whiteL)).toEqual({ status: "in-progress" });
    expect(cartOf(storage)).toBeNull(); // we did not add
  });
});

describe("journal protection", () => {
  it("an unfinished, referenced entry survives pruning even with >50 completed entries", async () => {
    const at = (i: number) => new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString();
    const completed = Array.from({ length: 60 }, (_, i) => ({
      opId: `done-${i}`,
      variantId: "v",
      completed: true,
      at: at(i),
    }));
    const storage = new FakeStorage({
      [CART_STORAGE_KEY]: envelope({
        lines: [],
        ops: [...completed, { opId: "pinned", variantId: "white-l", completed: false, at: at(0) }],
      }),
      [WISHLIST_STORAGE_KEY]: envelope({
        items: [
          {
            productId: P,
            colourId: null,
            addedAt: at(0),
            pendingMove: {
              opId: "pinned",
              variantId: "white-l",
              owner: "t",
              startedAt: at(0),
              leaseExpiresAt: at(1),
            },
          },
        ],
      }),
    });
    const session = tab(storage, new ChangeHub());
    await session.cart.add({
      variantId: "black-m",
      productId: "other",
      available: 5,
      isActive: true,
    });
    const ops = cartOf(storage)!.ops;
    expect(ops.filter((o) => o.completed)).toHaveLength(50);
    expect(ops.find((o) => o.opId === "pinned")).toMatchObject({ completed: false });
  });

  it("an unfinished entry no longer referenced (step 4 failed) is completed on the next cart write", async () => {
    const storage = new FakeStorage({
      [CART_STORAGE_KEY]: envelope({
        lines: [],
        ops: [{ opId: "orphan", variantId: "v", completed: false, at: "2026-11-14T09:00:00.000Z" }],
      }),
      [WISHLIST_STORAGE_KEY]: envelope({ items: [] }),
    });
    const session = tab(storage, new ChangeHub());
    await session.cart.add(whiteL);
    expect(cartOf(storage)!.ops.find((o) => o.opId === "orphan")?.completed).toBe(true);
  });

  it("keeps unfinished entries when the wishlist cannot be read reliably (foreign version)", async () => {
    const storage = new FakeStorage({
      [CART_STORAGE_KEY]: envelope({
        lines: [],
        ops: [
          { opId: "keep-me", variantId: "v", completed: false, at: "2026-11-14T09:00:00.000Z" },
        ],
      }),
      [WISHLIST_STORAGE_KEY]: JSON.stringify({ v: 99, data: {} }),
    });
    const session = tab(storage, new ChangeHub());
    await session.cart.add(whiteL);
    expect(cartOf(storage)!.ops.find((o) => o.opId === "keep-me")?.completed).toBe(false);
  });
});

describe("repositories via the session", () => {
  it("persists across sessions (simulated refresh) and reports counts", async () => {
    const storage = new FakeStorage();
    const first = tab(storage, new ChangeHub());
    await first.cart.add(whiteL, 2);
    await first.wishlist.toggle(P, "white");
    const afterRefresh = tab(storage, new ChangeHub());
    expect(afterRefresh.cart.getSnapshot().data.lines[0].quantity).toBe(2);
    expect(afterRefresh.wishlist.getSnapshot().data.items).toHaveLength(1);
  });

  it("works in memory when storage is unavailable", async () => {
    const session = createShoppingSession({
      adapter: null,
      locks: exclusiveLocks(),
      createId: ids,
    });
    expect(session.cart.getSnapshot()).toMatchObject({ status: "memory-only", persistent: false });
    expect(await session.cart.add(whiteL)).toMatchObject({ ok: true, quantity: 1 });
    await session.wishlist.save(P, null);
    expect(await session.moveToCart(P, whiteL)).toEqual({
      status: "moved",
      finishedPrevious: false,
    });
    expect(session.cart.getSnapshot().data.lines[0].quantity).toBe(2);
  });

  it("cart changes in one tab update the other tab's snapshot", async () => {
    const storage = new FakeStorage();
    const hub = new ChangeHub();
    const locks = exclusiveLocks();
    const tabA = tab(storage, hub, { locks });
    const tabB = tab(storage, hub, { locks });
    const unsubscribe = tabB.cart.subscribe(() => {});
    await tabA.cart.add(whiteL);
    expect(tabB.cart.getSnapshot().data.lines).toHaveLength(1);
    unsubscribe();
  });
});
