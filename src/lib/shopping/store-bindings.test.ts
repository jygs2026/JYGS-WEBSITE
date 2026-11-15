import { describe, expect, it, vi } from "vitest";

import { CART_STORAGE_KEY } from "@/lib/cart/cart-schema";
import { createInTabLockManager } from "@/lib/storage/cross-tab-lock";
import { ChangeHub, createTab, FakeStorage } from "@/test-utils/fake-storage";

import {
  CART_SERVER_SNAPSHOT,
  createSessionHost,
  createShoppingSession,
  peekShoppingSession,
  type ShoppingSession,
} from "./session";
import { createStoreBindings } from "./store-bindings";

function browserLikeHost(storage: FakeStorage, hub = new ChangeHub()) {
  const create = vi.fn((): ShoppingSession =>
    createShoppingSession({ adapter: createTab(storage, hub), locks: createInTabLockManager() }),
  );
  return { host: createSessionHost({ isBrowser: () => true, create }), create };
}

describe("render-safe store bindings", () => {
  it("getSnapshot never creates the session or touches storage (render phase)", () => {
    const storage = new FakeStorage({ [CART_STORAGE_KEY]: "{damaged" });
    const { host, create } = browserLikeHost(storage);
    const bindings = createStoreBindings(host, (s) => s.cart, CART_SERVER_SNAPSHOT);

    expect(bindings.getSnapshot()).toBe(CART_SERVER_SNAPSHOT);
    expect(bindings.getSnapshot()).toBe(CART_SERVER_SNAPSHOT); // stable reference
    expect(create).not.toHaveBeenCalled();
    expect(storage.writeLog).toEqual([]); // no backup/repair during render
    expect(storage.peek(CART_STORAGE_KEY)).toBe("{damaged");
  });

  it("subscribe (an effect) creates the session once, repairs storage there, and notifies React", () => {
    const storage = new FakeStorage({ [CART_STORAGE_KEY]: "{damaged" });
    const { host, create } = browserLikeHost(storage);
    const scheduled: (() => void)[] = [];
    const bindings = createStoreBindings(
      host,
      (s) => s.cart,
      CART_SERVER_SNAPSHOT,
      (task) => scheduled.push(task),
    );
    const listener = vi.fn();

    const unsubscribe = bindings.subscribe(listener);
    expect(create).toHaveBeenCalledTimes(1);
    expect(storage.writeLog.some((k) => k.startsWith(`${CART_STORAGE_KEY}:backup:`))).toBe(true);
    expect(scheduled).toHaveLength(1); // React will be asked to re-read once
    scheduled[0]();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(bindings.getSnapshot()).toMatchObject({ ready: true, status: "recovered" });

    // A second subscriber reuses the session and does not schedule again.
    const second = bindings.subscribe(vi.fn());
    expect(create).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveLength(1);
    second();
    unsubscribe();
  });

  it("cross-tab changes still reach subscribers after render-safe initialisation", async () => {
    const storage = new FakeStorage();
    const hub = new ChangeHub();
    const { host } = browserLikeHost(storage, hub);
    const bindings = createStoreBindings(
      host,
      (s) => s.cart,
      CART_SERVER_SNAPSHOT,
      () => {},
    );
    const listener = vi.fn();
    bindings.subscribe(listener);

    const otherTab = createShoppingSession({
      adapter: createTab(storage, hub),
      locks: createInTabLockManager(),
    });
    await otherTab.cart.add({ variantId: "v1", productId: "p1", available: 5, isActive: true });
    expect(listener).toHaveBeenCalled();
    expect(bindings.getSnapshot().data.lines).toHaveLength(1);
  });

  it("on the server: never creates a session; subscribe is a no-op", () => {
    const create = vi.fn();
    const host = createSessionHost({ isBrowser: () => false, create });
    const bindings = createStoreBindings(host, (s) => s.cart, CART_SERVER_SNAPSHOT);
    const unsubscribe = bindings.subscribe(vi.fn());
    expect(typeof unsubscribe).toBe("function");
    expect(bindings.getSnapshot()).toBe(CART_SERVER_SNAPSHOT);
    expect(bindings.getServerSnapshot()).toBe(CART_SERVER_SNAPSHOT);
    expect(create).not.toHaveBeenCalled();
  });

  it("the server snapshot is frozen and 'not ready'", () => {
    expect(Object.isFrozen(CART_SERVER_SNAPSHOT)).toBe(true);
    expect(CART_SERVER_SNAPSHOT).toMatchObject({ ready: false, data: { lines: [], ops: [] } });
  });

  it("the shared browser session is not created by importing the module (Node/SSR)", () => {
    expect(peekShoppingSession()).toBeNull();
  });
});
