/**
 * Test doubles for browser storage (unit tests only — never imported by app code).
 *
 * - FakeStorage: Web Storage–like map with failure injection and a write log.
 * - createTab(): a per-"tab" adapter over a shared FakeStorage; writes notify the OTHER tabs, as
 *   the browser `storage` event does.
 */
import type { StorageChangeListener, StorageLike } from "@/lib/storage/storage-adapter";
import { WebStorageAdapter } from "@/lib/storage/web-storage-adapter";

export class FakeStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  /** Keys passed to setItem / removeItem, in order. */
  readonly writeLog: string[] = [];
  /** Return true to make setItem throw for that key (e.g. quota exceeded). */
  failSetItem: ((key: string) => boolean) | null = null;
  failGetItem = false;
  /** Called after a successful setItem (lets tests inject a competing write from another tab). */
  onSet: ((key: string, value: string) => void) | null = null;

  constructor(initial?: Record<string, string>) {
    if (initial) for (const [k, v] of Object.entries(initial)) this.values.set(k, v);
  }

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string) {
    if (this.failGetItem) throw new Error("SecurityError: storage blocked");
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.failSetItem?.(key)) throw new Error("QuotaExceededError");
    this.writeLog.push(key);
    this.values.set(key, value);
    this.onSet?.(key, value);
  }

  removeItem(key: string) {
    this.writeLog.push(key);
    this.values.delete(key);
  }

  /** Direct access for assertions (bypasses failure injection). */
  peek(key: string) {
    return this.values.get(key) ?? null;
  }

  /** Raw seed without logging. */
  seed(key: string, value: string) {
    this.values.set(key, value);
  }
}

export class ChangeHub {
  private readonly listeners = new Map<object, Set<StorageChangeListener>>();

  on(tab: object, listener: StorageChangeListener): () => void {
    const set = this.listeners.get(tab) ?? new Set();
    set.add(listener);
    this.listeners.set(tab, set);
    return () => set.delete(listener);
  }

  emit(from: object, key: string | null) {
    for (const [tab, set] of this.listeners) {
      if (tab === from) continue;
      for (const listener of [...set]) listener(key);
    }
  }
}

/** A storage adapter representing one browser tab over a shared FakeStorage. */
export function createTab(shared: FakeStorage, hub: ChangeHub = new ChangeHub()) {
  const tab = {};
  const proxy: StorageLike = {
    get length() {
      return shared.length;
    },
    key: (i) => shared.key(i),
    getItem: (k) => shared.getItem(k),
    setItem: (k, v) => {
      shared.setItem(k, v);
      hub.emit(tab, k);
    },
    removeItem: (k) => {
      shared.removeItem(k);
      hub.emit(tab, k);
    },
  };
  return new WebStorageAdapter(proxy, (listener) => hub.on(tab, listener));
}

/** Fixed clock helper. */
export function clock(start = "2026-11-14T10:00:00.000Z") {
  let t = Date.parse(start);
  return {
    now: () => new Date(t),
    advance: (ms: number) => {
      t += ms;
    },
  };
}
