/**
 * Minimal key/value storage abstraction. Implemented by browser localStorage (persistent) and an
 * in-memory fallback (session only). A future backend repository replaces the layer above this.
 */

/** Called when another tab changes storage. `key` is null when storage was cleared. */
export type StorageChangeListener = (key: string | null) => void;

export interface StorageAdapter {
  /** True when data survives a page refresh. */
  readonly persistent: boolean;
  /** May throw (e.g. SecurityError). Callers must handle errors. */
  getItem(key: string): string | null;
  /** May throw (e.g. QuotaExceededError). Callers must handle errors. */
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** All keys currently stored. */
  keys(): string[];
  /** Cross-tab change notifications (browser `storage` event). */
  subscribe(listener: StorageChangeListener): () => void;
}

/** The subset of the Web Storage API we rely on (lets tests supply a fake). */
export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PROBE_KEY = "__jygs_storage_probe__";

/** True when the storage can actually be written (false in some private modes / when blocked). */
export function isStorageUsable(storage: StorageLike): boolean {
  try {
    storage.setItem(PROBE_KEY, "1");
    storage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}
