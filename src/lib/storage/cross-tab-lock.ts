/**
 * Cross-tab mutual exclusion for read-modify-write updates of browser storage.
 *
 * - With the Web Locks API (current Edge/Chrome/Firefox, Safari 15.4+), `run()` is exclusive across
 *   all tabs of the same browser profile.
 * - Without it, operations are only serialized within the current tab (`exclusive: false`); a small
 *   cross-tab race window remains. This is best-effort, never transactional.
 *
 * Deadlock rule: any operation needing both locks acquires "jygs:cart" BEFORE "jygs:wishlist".
 */

export const DEFAULT_LOCK_TIMEOUT_MS = 5000;

export class LockTimeoutError extends Error {
  constructor(readonly lockName: string) {
    super(`Timed out waiting for lock "${lockName}"`);
    this.name = "LockTimeoutError";
  }
}

export interface LockManager {
  /** True when locks exclude other tabs (Web Locks); false for the in-tab fallback. */
  readonly exclusive: boolean;
  run<T>(name: string, fn: () => T | Promise<T>, options?: { timeoutMs?: number }): Promise<T>;
}

/** The subset of `navigator.locks` we use. */
export interface WebLocksLike {
  request(
    name: string,
    options: { signal?: AbortSignal },
    callback: () => unknown,
  ): Promise<unknown>;
}

export function createWebLockManager(locks: WebLocksLike): LockManager {
  return {
    exclusive: true,
    async run<T>(name: string, fn: () => T | Promise<T>, options?: { timeoutMs?: number }) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        options?.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS,
      );
      let granted = false;
      try {
        const result = await locks.request(name, { signal: controller.signal }, async () => {
          granted = true;
          clearTimeout(timer);
          return fn();
        });
        return result as T;
      } catch (error) {
        if (!granted && controller.signal.aborted) throw new LockTimeoutError(name);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Serializes operations per lock name within this tab only. */
export function createInTabLockManager(): LockManager {
  const tails = new Map<string, Promise<void>>();
  return {
    exclusive: false,
    run<T>(name: string, fn: () => T | Promise<T>, options?: { timeoutMs?: number }) {
      const previous = tails.get(name) ?? Promise.resolve();
      let release!: () => void;
      const done = new Promise<void>((resolve) => (release = resolve));
      tails.set(
        name,
        previous.then(() => done),
      );
      return new Promise<T>((resolve, reject) => {
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          reject(new LockTimeoutError(name));
        }, options?.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS);
        void previous.then(async () => {
          if (timedOut) {
            release();
            return;
          }
          clearTimeout(timer);
          try {
            resolve(await fn());
          } catch (error) {
            reject(error);
          } finally {
            release();
          }
        });
      });
    },
  };
}

/** Web Locks when available, otherwise the in-tab fallback. Never throws. */
export function getLockManager(): LockManager {
  try {
    const locks =
      typeof navigator !== "undefined"
        ? (navigator as Navigator & { locks?: WebLocksLike }).locks
        : undefined;
    if (locks && typeof locks.request === "function") return createWebLockManager(locks);
  } catch {
    // fall through
  }
  return createInTabLockManager();
}
