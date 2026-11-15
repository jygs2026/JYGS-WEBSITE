/**
 * PersistentStore — a framework-free, subscribable store for one versioned storage key, designed
 * for React's `useSyncExternalStore`.
 *
 * Every mutation is a synchronous read-modify-write: it re-reads the latest stored value, applies
 * a pure update and writes the result in the same JavaScript task (callers wrap it in a cross-tab
 * lock where available). localStorage itself has no transactions: without Web Locks two tabs
 * writing at the same instant can still lose an update (last writer wins).
 *
 * Backends: browser storage (persistent) or a session-only MemoryStorageAdapter. Memory is used
 * when browser storage is unavailable, when stored data must be preserved untouched (unknown
 * version / unreadable), or after a write failure. Both backends go through the same versioned
 * read/write path; memory mode always reports `persistent: false` with the reason in `status`.
 */
import { MemoryStorageAdapter } from "./memory-storage-adapter";
import type { StorageAdapter } from "./storage-adapter";
import {
  readStore,
  writeEnvelope,
  type ReadOutcome,
  type ReadStatus,
  type StoreSchema,
} from "./versioned-store";

export interface StoreSnapshot<T> {
  /** False during server rendering / before the browser value has been read. */
  ready: boolean;
  data: T;
  status: ReadStatus;
  /** True only while changes are being saved to persistent browser storage. */
  persistent: boolean;
  dropped: number;
  rev: number;
  backupKey?: string;
}

export type StoreBackend = "browser-storage" | "memory";

export class StoreWriteError extends Error {
  constructor(readonly key: string) {
    super(`Could not save "${key}"`);
    this.name = "StoreWriteError";
  }
}

export interface MutationResult<T, R> {
  data: T;
  result: R;
}

export interface MutateOptions {
  /**
   * Strict mode (used by multi-step workflows): if the write to browser storage fails, throw
   * StoreWriteError and leave the in-memory state unchanged instead of degrading to memory.
   */
  strict?: boolean;
}

export interface PersistentStoreOptions<T> {
  now?: () => Date;
  random?: () => number;
  /** Applied to every changed value just before it is saved (e.g. journal pruning). */
  beforeWrite?: (data: T) => T;
}

/** A frozen "not ready" snapshot for server rendering (same object every call). */
export function createServerSnapshot<T>(schema: StoreSchema<T>): StoreSnapshot<T> {
  return Object.freeze({
    ready: false,
    data: schema.empty(),
    status: "empty" as const,
    persistent: true,
    dropped: 0,
    rev: 0,
  });
}

export class PersistentStore<T> {
  /** Where reads and writes currently go. */
  private backend: StorageAdapter;
  /** True while `backend` is persistent browser storage. */
  private persistent: boolean;
  /** Why the store is in memory (customer-facing reason). */
  private memoryReason: ReadStatus = "memory-only";
  private snapshot: StoreSnapshot<T>;
  private readonly listeners = new Set<() => void>();
  private detach: (() => void) | null = null;
  private readonly now: () => Date;
  private readonly random: () => number;

  constructor(
    private readonly schema: StoreSchema<T>,
    adapter: StorageAdapter | null,
    private readonly options: PersistentStoreOptions<T> = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;

    if (adapter && adapter.persistent) {
      const outcome = readStore(adapter, schema, this.now, this.random);
      if (outcome.writable) {
        this.backend = adapter;
        this.persistent = true;
        this.snapshot = this.toSnapshot(outcome, true);
        return;
      }
      // Preserve the stored value untouched; work on a session-only copy.
      this.backend = new MemoryStorageAdapter();
      this.persistent = false;
      this.memoryReason = outcome.status;
      this.seedMemory(outcome.data, outcome.rev);
      this.snapshot = this.toSnapshot(outcome, false);
      return;
    }

    // Browser storage unavailable: a MemoryStorageAdapter (supplied or created) is the fallback.
    this.backend = adapter ?? new MemoryStorageAdapter();
    this.persistent = false;
    const outcome = readStore(this.backend, schema, this.now, this.random);
    this.snapshot = { ...this.toSnapshot(outcome, false), status: "memory-only" };
  }

  get key(): string {
    return this.schema.key;
  }

  /** Where changes are currently written. */
  getBackend(): StoreBackend {
    return this.persistent ? "browser-storage" : "memory";
  }

  /** The adapter currently receiving reads/writes (diagnostics and tests). */
  get activeAdapter(): StorageAdapter {
    return this.backend;
  }

  getSnapshot = (): StoreSnapshot<T> => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1 && this.persistent) {
      this.detach = this.backend.subscribe((changedKey) => {
        if (changedKey === null || changedKey === this.schema.key) this.refresh();
      });
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.detach) {
        this.detach();
        this.detach = null;
      }
    };
  };

  /** True when the store reflects a readable value (not a preserved unknown/unreadable one). */
  isReliable(): boolean {
    return this.snapshot.status !== "foreign-version" && this.snapshot.status !== "unreadable";
  }

  /** Re-reads the backend and returns the freshest data (also updates subscribers). */
  readFresh(): T {
    const outcome = readStore(this.backend, this.schema, this.now, this.random);
    if (!outcome.writable) {
      if (this.persistent) {
        this.switchToMemory(
          outcome.status,
          this.snapshot.data,
          this.snapshot.rev,
          outcome.backupKey,
        );
      }
      return this.snapshot.data;
    }
    if (
      this.persistent &&
      (outcome.rev !== this.snapshot.rev || outcome.status !== this.snapshot.status)
    ) {
      this.setSnapshot(this.toSnapshot(outcome, true));
    }
    return outcome.data;
  }

  /** Re-reads after a cross-tab change notification. */
  refresh(): void {
    this.readFresh();
  }

  /**
   * Synchronous read-modify-write. `fn` must be pure and return the same `data` object when
   * nothing changes (no write happens then).
   */
  mutateNow<R>(fn: (data: T) => MutationResult<T, R>, options: MutateOptions = {}): R {
    const fresh = readStore(this.backend, this.schema, this.now, this.random);
    if (!fresh.writable && this.persistent) {
      // Unknown/unreadable data appeared: preserve it and continue in memory.
      this.switchToMemory(fresh.status, this.snapshot.data, this.snapshot.rev, fresh.backupKey);
      return this.mutateNow(fn, options);
    }
    const current = fresh.writable
      ? fresh
      : { ...fresh, data: this.snapshot.data, rev: this.snapshot.rev };

    const { data, result } = fn(current.data);
    if (data === current.data) {
      if (
        this.persistent &&
        (current.rev !== this.snapshot.rev || current.status !== this.snapshot.status)
      ) {
        this.setSnapshot(this.toSnapshot(current, true));
      }
      return result;
    }

    const next = this.options.beforeWrite ? this.options.beforeWrite(data) : data;
    const rev = current.rev + 1;
    try {
      writeEnvelope(this.backend, this.schema, next, rev, this.now);
    } catch {
      if (!this.persistent) throw new StoreWriteError(this.schema.key); // memory never fails
      if (options.strict) {
        this.setSnapshot(this.toSnapshot(current, true));
        throw new StoreWriteError(this.schema.key);
      }
      this.switchToMemory("memory-only", next, rev);
      return result;
    }

    this.setSnapshot(
      this.persistent
        ? { ready: true, data: next, status: "ok", persistent: true, dropped: 0, rev }
        : { ...this.snapshot, data: next, rev, status: this.memoryReason, persistent: false },
    );
    return result;
  }

  /** Moves to a session-only MemoryStorageAdapter seeded with the current data. */
  private switchToMemory(status: ReadStatus, data: T, rev: number, backupKey?: string): void {
    this.backend = new MemoryStorageAdapter();
    this.persistent = false;
    this.memoryReason = status;
    this.seedMemory(data, rev);
    if (this.detach) {
      this.detach();
      this.detach = null;
    }
    this.setSnapshot({
      ready: true,
      data,
      status,
      persistent: false,
      dropped: this.snapshot.dropped,
      rev,
      backupKey: backupKey ?? this.snapshot.backupKey,
    });
  }

  private seedMemory(data: T, rev: number): void {
    writeEnvelope(this.backend, this.schema, data, rev, this.now);
  }

  private toSnapshot(outcome: ReadOutcome<T>, persistent: boolean): StoreSnapshot<T> {
    return {
      ready: true,
      data: outcome.data,
      status: outcome.status,
      persistent,
      dropped: outcome.dropped,
      rev: outcome.rev,
      backupKey: outcome.backupKey,
    };
  }

  private setSnapshot(next: StoreSnapshot<T>): void {
    this.snapshot = next;
    for (const listener of [...this.listeners]) listener();
  }
}
