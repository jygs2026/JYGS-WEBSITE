import type { StorageAdapter } from "./storage-adapter";

/**
 * In-memory adapter: the fallback when browser storage is unavailable. Data lives only for the
 * current page session and is lost on refresh.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  readonly persistent = false;
  private readonly values = new Map<string, string>();

  constructor(initial?: Record<string, string>) {
    if (initial) for (const [key, value] of Object.entries(initial)) this.values.set(key, value);
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  keys(): string[] {
    return [...this.values.keys()];
  }

  subscribe(): () => void {
    return () => {};
  }
}
