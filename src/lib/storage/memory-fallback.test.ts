import { describe, expect, it, vi } from "vitest";

import { CART_STORAGE_KEY } from "@/lib/cart/cart-schema";
import { createShoppingSession } from "@/lib/shopping/session";
import { clock, FakeStorage } from "@/test-utils/fake-storage";

import { createInTabLockManager } from "./cross-tab-lock";
import { PersistentStore } from "./external-store";
import { MemoryStorageAdapter } from "./memory-storage-adapter";
import type { StoreSchema } from "./versioned-store";
import { WebStorageAdapter } from "./web-storage-adapter";

interface Names {
  names: string[];
}
const schema: StoreSchema<Names> = {
  key: "test:names",
  version: 1,
  empty: () => ({ names: [] }),
  validate: (d) =>
    typeof d === "object" && d !== null && Array.isArray((d as Names).names)
      ? { data: { names: (d as Names).names.filter((n) => typeof n === "string") }, dropped: 0 }
      : null,
};
const { now } = clock();
const add = (name: string) => (d: Names) => ({
  data: { names: [...d.names, name] },
  result: undefined,
});
const env = (data: unknown, v = 1) =>
  JSON.stringify({ v, rev: 1, updatedAt: "2026-01-01T00:00:00.000Z", data });

describe("MemoryStorageAdapter as the runtime fallback", () => {
  it("no browser storage → a MemoryStorageAdapter backend; usable; never reported persistent", () => {
    const store = new PersistentStore(schema, null, { now });
    expect(store.activeAdapter).toBeInstanceOf(MemoryStorageAdapter);
    expect(store.getBackend()).toBe("memory");
    expect(store.getSnapshot()).toMatchObject({
      ready: true,
      status: "memory-only",
      persistent: false,
    });

    store.mutateNow(add("a"));
    store.mutateNow(add("b"));
    expect(store.getSnapshot()).toMatchObject({
      data: { names: ["a", "b"] },
      persistent: false,
      status: "memory-only",
    });
    expect(store.readFresh().names).toEqual(["a", "b"]);
    // Data goes through the same versioned envelope, inside the memory adapter.
    expect(JSON.parse(store.activeAdapter.getItem("test:names")!)).toMatchObject({
      v: 1,
      rev: 2,
      data: { names: ["a", "b"] },
    });
  });

  it("a supplied MemoryStorageAdapter is used as-is", () => {
    const memory = new MemoryStorageAdapter();
    const store = new PersistentStore(schema, memory, { now });
    store.mutateNow(add("x"));
    expect(store.activeAdapter).toBe(memory);
    expect(store.getSnapshot().persistent).toBe(false);
  });

  it("memory data does not survive a 'refresh' (new store, new memory adapter)", () => {
    const first = new PersistentStore(schema, null, { now });
    first.mutateNow(add("gone"));
    const afterRefresh = new PersistentStore(schema, null, { now });
    expect(afterRefresh.getSnapshot().data.names).toEqual([]);
  });

  it("does not subscribe to cross-tab events while in memory", () => {
    const memory = new MemoryStorageAdapter();
    const spy = vi.spyOn(memory, "subscribe");
    const store = new PersistentStore(schema, memory, { now });
    store.subscribe(() => {})();
    expect(spy).not.toHaveBeenCalled();
  });

  it("unknown stored version → copy-on-memory; browser value untouched; reason kept after changes", () => {
    const raw = env({ names: ["future"] }, 5);
    const storage = new FakeStorage({ "test:names": raw });
    const browser = new WebStorageAdapter(storage);
    const store = new PersistentStore(schema, browser, { now });
    expect(store.activeAdapter).toBeInstanceOf(MemoryStorageAdapter);
    expect(store.activeAdapter).not.toBe(browser);
    store.mutateNow(add("session"));
    expect(store.getSnapshot()).toMatchObject({
      status: "foreign-version",
      persistent: false,
      data: { names: ["session"] },
    });
    expect(storage.peek("test:names")).toBe(raw);
    expect(storage.writeLog).toEqual([]);
  });

  it("write failure → switches to memory with the change kept; no further browser writes this session", () => {
    const storage = new FakeStorage({ "test:names": env({ names: ["saved"] }) });
    const store = new PersistentStore(schema, new WebStorageAdapter(storage), { now });
    expect(store.getBackend()).toBe("browser-storage");

    storage.failSetItem = () => true;
    store.mutateNow(add("unsaved"));
    expect(store.getBackend()).toBe("memory");
    expect(store.activeAdapter).toBeInstanceOf(MemoryStorageAdapter);
    expect(store.getSnapshot()).toMatchObject({
      status: "memory-only",
      persistent: false,
      data: { names: ["saved", "unsaved"] },
    });

    storage.failSetItem = null; // storage works again — still no writes until a new page session
    store.mutateNow(add("still-memory"));
    expect(storage.writeLog).toEqual([]);
    expect(JSON.parse(storage.peek("test:names")!).data.names).toEqual(["saved"]);
    expect(store.getSnapshot().data.names).toEqual(["saved", "unsaved", "still-memory"]);
  });
});

describe("session fallback", () => {
  it("createShoppingSession without browser storage uses memory for cart and wishlist", async () => {
    const session = createShoppingSession({ adapter: null, locks: createInTabLockManager() });
    expect(session.cart.store.getBackend()).toBe("memory");
    expect(session.wishlist.store.getBackend()).toBe("memory");
    expect(session.cart.store.activeAdapter).toBeInstanceOf(MemoryStorageAdapter);

    expect(
      await session.cart.add({ variantId: "v", productId: "p", available: 3, isActive: true }),
    ).toMatchObject({ ok: true });
    expect(await session.wishlist.toggle("p", null)).toEqual({ ok: true, saved: true });
    expect(session.cart.getSnapshot()).toMatchObject({ persistent: false, status: "memory-only" });
    expect(session.cart.getSnapshot().data.lines).toHaveLength(1);
  });

  it("cart and wishlist share one MemoryStorageAdapter when passed explicitly (as the browser fallback does)", async () => {
    const memory = new MemoryStorageAdapter();
    const session = createShoppingSession({ adapter: memory, locks: createInTabLockManager() });
    await session.cart.add({ variantId: "v", productId: "p", available: 3, isActive: true });
    expect(memory.getItem(CART_STORAGE_KEY)).not.toBeNull();
    expect(session.cart.getSnapshot().persistent).toBe(false);
  });
});
