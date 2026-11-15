import {
  isStorageUsable,
  type StorageAdapter,
  type StorageChangeListener,
  type StorageLike,
} from "./storage-adapter";

/** Subscribes to cross-tab changes; returns an unsubscribe function. */
export type ChangeSubscriber = (listener: StorageChangeListener) => () => void;

/** localStorage-backed adapter. All browser access errors propagate to the caller. */
export class WebStorageAdapter implements StorageAdapter {
  readonly persistent = true;

  constructor(
    private readonly storage: StorageLike,
    private readonly subscribeToChanges?: ChangeSubscriber,
  ) {}

  getItem(key: string): string | null {
    return this.storage.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.storage.setItem(key, value);
  }

  removeItem(key: string): void {
    this.storage.removeItem(key);
  }

  keys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key !== null) keys.push(key);
    }
    return keys;
  }

  subscribe(listener: StorageChangeListener): () => void {
    return this.subscribeToChanges ? this.subscribeToChanges(listener) : () => {};
  }
}

/**
 * The browser's localStorage as an adapter, or null when unavailable (server rendering, blocked
 * storage, private modes that refuse writes). Never throws.
 */
export function getBrowserStorageAdapter(): WebStorageAdapter | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    if (!storage || !isStorageUsable(storage)) return null;
    const subscribe: ChangeSubscriber = (listener) => {
      const handler = (event: StorageEvent) => {
        if (event.storageArea === storage) listener(event.key);
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    };
    return new WebStorageAdapter(storage, subscribe);
  } catch {
    return null;
  }
}
