import { describe, expect, it, vi } from "vitest";

import { ChangeHub, clock, createTab, FakeStorage } from "@/test-utils/fake-storage";

import {
  createInTabLockManager,
  createWebLockManager,
  LockTimeoutError,
  type WebLocksLike,
} from "./cross-tab-lock";
import { PersistentStore, StoreWriteError } from "./external-store";
import { MemoryStorageAdapter } from "./memory-storage-adapter";
import { isStorageUsable } from "./storage-adapter";
import { backupMalformedValue, backupPrefix, readStore, type StoreSchema } from "./versioned-store";
import { WebStorageAdapter } from "./web-storage-adapter";

// A small test schema: { names: string[] } — invalid entries (non-strings) are dropped.
interface Names {
  names: string[];
}
const schema: StoreSchema<Names> = {
  key: "test:names",
  version: 2,
  empty: () => ({ names: [] }),
  validate: (data) => {
    if (typeof data !== "object" || data === null || !Array.isArray((data as Names).names))
      return null;
    const all = (data as { names: unknown[] }).names;
    const names = all.filter((n): n is string => typeof n === "string");
    return { data: { names }, dropped: all.length - names.length };
  },
  // Synthetic legacy migration: v1 stored { list: string[] }.
  migrations: { 1: (d) => ({ names: (d as { list: unknown[] }).list }) },
};
const env = (data: unknown, v = 2, rev = 3) =>
  JSON.stringify({ v, rev, updatedAt: "2026-01-01T00:00:00.000Z", data });
const { now } = clock();

function setup(initial?: Record<string, string>) {
  const storage = new FakeStorage(initial);
  const adapter = new WebStorageAdapter(storage);
  return { storage, adapter };
}

describe("readStore classification", () => {
  it("empty → start empty, writable", () => {
    const { adapter } = setup();
    expect(readStore(adapter, schema, now)).toMatchObject({
      status: "empty",
      writable: true,
      data: { names: [] },
    });
  });

  it("ok → current version used as stored", () => {
    const { adapter } = setup({ "test:names": env({ names: ["a", "b"] }) });
    expect(readStore(adapter, schema, now)).toMatchObject({
      status: "ok",
      rev: 3,
      data: { names: ["a", "b"] },
    });
  });

  it("partial → valid entries kept, invalid counted, NOTHING written", () => {
    const { adapter, storage } = setup({ "test:names": env({ names: ["a", 1, null, "b"] }) });
    const before = storage.peek("test:names");
    const outcome = readStore(adapter, schema, now);
    expect(outcome).toMatchObject({
      status: "partial",
      dropped: 2,
      writable: true,
      data: { names: ["a", "b"] },
    });
    expect(storage.peek("test:names")).toBe(before);
    expect(storage.writeLog).toEqual([]);
  });

  it("migrated → older version converted and written as the current version", () => {
    const { adapter, storage } = setup({ "test:names": env({ list: ["x"] }, 1, 4) });
    const outcome = readStore(adapter, schema, now);
    expect(outcome).toMatchObject({ status: "migrated", rev: 5, data: { names: ["x"] } });
    expect(JSON.parse(storage.peek("test:names")!)).toMatchObject({
      v: 2,
      rev: 5,
      data: { names: ["x"] },
    });
  });

  it.each([
    ["future version", env({ names: ["a"] }, 3)],
    ["missing version", JSON.stringify({ data: { names: ["a"] } })],
    ["non-numeric version", JSON.stringify({ v: "2", data: { names: [] } })],
    ["version 0 without migration", env({ names: [] }, 0)],
    ["bare array (unrecognised shape)", JSON.stringify(["a", "b"])],
    ["current version, unrecognised data shape", env({ wrong: true })],
  ])("foreign-version (%s) → original preserved byte-for-byte, not writable", (_label, raw) => {
    const { adapter, storage } = setup({ "test:names": raw });
    const outcome = readStore(adapter, schema, now);
    expect(outcome).toMatchObject({
      status: "foreign-version",
      writable: false,
      data: { names: [] },
    });
    expect(storage.peek("test:names")).toBe(raw);
    expect(storage.writeLog).toEqual([]);
  });

  it("storage unavailable on read → memory-only", () => {
    const { adapter, storage } = setup();
    storage.failGetItem = true;
    expect(readStore(adapter, schema, now)).toMatchObject({
      status: "memory-only",
      writable: false,
    });
  });
});

describe("malformed JSON recovery and backups", () => {
  it("backs up to a new unique key, then resets", () => {
    const { adapter, storage } = setup({ "test:names": "{not json" });
    const outcome = readStore(adapter, schema, now, () => 0.25);
    expect(outcome.status).toBe("recovered");
    expect(outcome.backupKey).toMatch(/^test:names:backup:2026-11-14T10-00-00-000Z-[0-9a-z]{6}$/);
    expect(storage.peek(outcome.backupKey!)).toBe("{not json");
    expect(JSON.parse(storage.peek("test:names")!)).toMatchObject({ v: 2, data: { names: [] } });
  });

  it("never overwrites, modifies or deletes an existing backup; reads it only for duplicates", () => {
    const existingKey = `${backupPrefix("test:names")}2026-01-01T00-00-00-000Z-aaaaaa`;
    const { adapter, storage } = setup({
      [existingKey]: "old damaged text",
      "test:names": "new damaged{",
    });
    const outcome = readStore(adapter, schema, now, () => 0.5);
    expect(outcome.status).toBe("recovered");
    expect(outcome.backupKey).not.toBe(existingKey);
    expect(storage.peek(existingKey)).toBe("old damaged text");
    expect(storage.writeLog).not.toContain(existingKey);
  });

  it("reuses an identical existing backup instead of writing a duplicate", () => {
    const existingKey = `${backupPrefix("test:names")}2026-01-01T00-00-00-000Z-bbbbbb`;
    const { adapter, storage } = setup({ [existingKey]: "same{", "test:names": "same{" });
    const outcome = readStore(adapter, schema, now);
    expect(outcome).toMatchObject({ status: "recovered", backupKey: existingKey });
    expect(storage.writeLog.filter((k) => k.includes(":backup:"))).toEqual([]);
  });

  it("retries with a new suffix on a key collision (never overwrites)", () => {
    const { adapter, storage } = setup();
    const randoms = [0.1, 0.1, 0.9];
    const random = () => randoms.shift() ?? 0.3;
    const first = backupMalformedValue(adapter, "k", "one", now, random);
    const second = backupMalformedValue(adapter, "k", "two", now, random);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.key).not.toBe(first.key);
      expect(storage.peek(first.key)).toBe("one");
      expect(storage.peek(second.key)).toBe("two");
    }
  });

  it("keeps the original and goes memory-only when the backup cannot be written", () => {
    const { adapter, storage } = setup({ "test:names": "broken{" });
    storage.failSetItem = (key) => key.includes(":backup:");
    const outcome = readStore(adapter, schema, now);
    expect(outcome).toMatchObject({ status: "unreadable", writable: false });
    expect(storage.peek("test:names")).toBe("broken{");
  });
});

describe("PersistentStore", () => {
  const add = (name: string) => (d: Names) => ({
    data: { names: [...d.names, name] },
    result: undefined,
  });

  it("read-modify-write re-reads storage so another tab's change is not lost", () => {
    const shared = new FakeStorage();
    const hub = new ChangeHub();
    const tabA = new PersistentStore(schema, createTab(shared, hub), { now });
    const tabB = new PersistentStore(schema, createTab(shared, hub), { now });
    tabA.mutateNow(add("a"));
    tabB.mutateNow(add("b")); // B's snapshot is stale, but it re-reads before writing
    expect(JSON.parse(shared.peek("test:names")!).data.names).toEqual(["a", "b"]);
    expect(JSON.parse(shared.peek("test:names")!).rev).toBe(2);
  });

  it("cross-tab storage events refresh subscribers", () => {
    const shared = new FakeStorage();
    const hub = new ChangeHub();
    const tabA = new PersistentStore(schema, createTab(shared, hub), { now });
    const tabB = new PersistentStore(schema, createTab(shared, hub), { now });
    const listener = vi.fn();
    tabB.subscribe(listener);
    tabA.mutateNow(add("from-a"));
    expect(listener).toHaveBeenCalled();
    expect(tabB.getSnapshot().data.names).toEqual(["from-a"]);
  });

  it("does not write when nothing changes", () => {
    const { adapter, storage } = setup();
    const store = new PersistentStore(schema, adapter, { now });
    store.mutateNow((d) => ({ data: d, result: undefined }));
    expect(storage.writeLog).toEqual([]);
  });

  it("partial data is cleaned only on the customer's next change", () => {
    const { adapter, storage } = setup({ "test:names": env({ names: ["a", 7] }) });
    const store = new PersistentStore(schema, adapter, { now });
    expect(store.getSnapshot()).toMatchObject({ status: "partial", dropped: 1 });
    expect(storage.writeLog).toEqual([]);
    store.mutateNow(add("b"));
    expect(JSON.parse(storage.peek("test:names")!).data.names).toEqual(["a", "b"]);
    expect(store.getSnapshot().status).toBe("ok");
  });

  it("foreign data stays untouched across customer changes (memory only)", () => {
    const raw = env({ names: ["future"] }, 9);
    const { adapter, storage } = setup({ "test:names": raw });
    const store = new PersistentStore(schema, adapter, { now });
    expect(store.getSnapshot()).toMatchObject({ status: "foreign-version", persistent: false });
    store.mutateNow(add("session-only"));
    expect(store.getSnapshot().data.names).toEqual(["session-only"]);
    expect(storage.peek("test:names")).toBe(raw);
    expect(storage.writeLog).toEqual([]);
  });

  it("switches to memory if foreign data appears from another tab", () => {
    const { adapter, storage } = setup({ "test:names": env({ names: ["a"] }) });
    const store = new PersistentStore(schema, adapter, { now });
    const foreign = env({ names: ["?"] }, 7);
    storage.seed("test:names", foreign);
    store.mutateNow(add("b"));
    expect(store.getSnapshot()).toMatchObject({ status: "foreign-version", persistent: false });
    expect(storage.peek("test:names")).toBe(foreign);
  });

  it("write failure degrades to memory-only (non-strict) and keeps the change", () => {
    const { adapter, storage } = setup();
    const store = new PersistentStore(schema, adapter, { now });
    storage.failSetItem = () => true;
    store.mutateNow(add("kept"));
    expect(store.getSnapshot()).toMatchObject({
      status: "memory-only",
      persistent: false,
      data: { names: ["kept"] },
    });
  });

  it("strict write failure throws and leaves state unchanged", () => {
    const { adapter, storage } = setup({ "test:names": env({ names: ["a"] }) });
    const store = new PersistentStore(schema, adapter, { now });
    storage.failSetItem = () => true;
    expect(() => store.mutateNow(add("x"), { strict: true })).toThrow(StoreWriteError);
    expect(store.getSnapshot().data.names).toEqual(["a"]);
  });

  it("no adapter (storage unavailable) → memory-only, still usable", () => {
    const store = new PersistentStore(schema, null, { now });
    expect(store.getSnapshot()).toMatchObject({
      status: "memory-only",
      persistent: false,
      ready: true,
    });
    store.mutateNow(add("m"));
    expect(store.getSnapshot().data.names).toEqual(["m"]);
  });

  it("applies beforeWrite to every saved value", () => {
    const { adapter, storage } = setup();
    const store = new PersistentStore(schema, adapter, {
      now,
      beforeWrite: (d) => ({ names: d.names.map((n) => n.toUpperCase()) }),
    });
    store.mutateNow(add("x"));
    expect(JSON.parse(storage.peek("test:names")!).data.names).toEqual(["X"]);
  });
});

describe("adapters", () => {
  it("isStorageUsable detects blocked storage", () => {
    const blocked = new FakeStorage();
    blocked.failSetItem = () => true;
    expect(isStorageUsable(blocked)).toBe(false);
    expect(isStorageUsable(new FakeStorage())).toBe(true);
  });

  it("MemoryStorageAdapter is non-persistent and keeps values in memory", () => {
    const memory = new MemoryStorageAdapter({ a: "1" });
    memory.setItem("b", "2");
    expect(memory.persistent).toBe(false);
    expect(memory.keys().sort()).toEqual(["a", "b"]);
  });
});

describe("lock managers", () => {
  it("in-tab manager serializes operations per name", async () => {
    const locks = createInTabLockManager();
    const order: string[] = [];
    const slow = locks.run("k", async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push("first");
    });
    const fast = locks.run("k", () => {
      order.push("second");
    });
    await Promise.all([slow, fast]);
    expect(order).toEqual(["first", "second"]);
  });

  it("in-tab manager times out waiting for a held lock", async () => {
    const locks = createInTabLockManager();
    const held = locks.run("k", () => new Promise((r) => setTimeout(r, 100)));
    await expect(locks.run("k", () => "never", { timeoutMs: 10 })).rejects.toBeInstanceOf(
      LockTimeoutError,
    );
    await held;
  });

  it("web lock manager passes an abort signal and maps aborts to LockTimeoutError", async () => {
    const neverGranted: WebLocksLike = {
      request: (_name, options) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    };
    const locks = createWebLockManager(neverGranted);
    expect(locks.exclusive).toBe(true);
    await expect(locks.run("k", () => 1, { timeoutMs: 10 })).rejects.toBeInstanceOf(
      LockTimeoutError,
    );

    const granted: WebLocksLike = { request: async (_n, _o, cb) => cb() };
    await expect(createWebLockManager(granted).run("k", () => 42)).resolves.toBe(42);
  });
});
