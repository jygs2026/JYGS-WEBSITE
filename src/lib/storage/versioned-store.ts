/**
 * Versioned storage envelope + safe read/recovery rules for one storage key.
 *
 * Envelope: { v: <schema version>, rev: <write counter>, updatedAt: ISO, data: <payload> }
 *
 * Read classification (see the approved M3 plan):
 *   empty            — nothing stored                                   → start empty
 *   ok               — current version, all entries valid               → use it
 *   migrated         — older version with registered migrations         → migrate, write current
 *   partial          — current version, some entries invalid            → use valid ones; NO auto-write
 *   recovered        — malformed JSON, backed up to a NEW unique key     → reset to empty
 *   unreadable       — malformed JSON that could not be backed up       → keep original; memory only
 *   foreign-version  — unknown/future version or unrecognised shape     → keep original; memory only
 *   memory-only      — storage unavailable or a write failed            → memory only
 *
 * Backup keys ("<key>:backup:<timestamp>-<suffix>") are NEVER overwritten, modified or deleted.
 * They are read only to avoid storing the same damaged text twice.
 */
import type { StorageAdapter } from "./storage-adapter";

export type ReadStatus =
  | "empty"
  | "ok"
  | "migrated"
  | "partial"
  | "recovered"
  | "unreadable"
  | "foreign-version"
  | "memory-only";

export interface StoreSchema<T> {
  key: string;
  /** Current schema version (positive integer). */
  version: number;
  empty(): T;
  /**
   * Validates current-version data. Returns cleaned data and the number of user-visible entries
   * dropped, or null when the overall shape is unrecognised.
   */
  validate(data: unknown): { data: T; dropped: number } | null;
  /** migrations[n] converts version n data to version n + 1. */
  migrations?: Readonly<Record<number, (data: unknown) => unknown>>;
}

export interface ReadOutcome<T> {
  data: T;
  rev: number;
  status: ReadStatus;
  /** Invalid entries left out (status "partial"). */
  dropped: number;
  /** False when the key must not be written (preserve unknown/unreadable data). */
  writable: boolean;
  backupKey?: string;
}

export const backupPrefix = (key: string) => `${key}:backup:`;

const MAX_BACKUP_KEY_ATTEMPTS = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEnvelope(value: unknown): { v: number; rev: number; data: unknown } | null {
  if (!isRecord(value) || !Number.isInteger(value.v) || !("data" in value)) return null;
  const rev = Number.isInteger(value.rev) && (value.rev as number) >= 0 ? (value.rev as number) : 0;
  return { v: value.v as number, rev, data: value.data };
}

export function writeEnvelope<T>(
  adapter: StorageAdapter,
  schema: StoreSchema<T>,
  data: T,
  rev: number,
  now: () => Date,
): void {
  adapter.setItem(
    schema.key,
    JSON.stringify({ v: schema.version, rev, updatedAt: now().toISOString(), data }),
  );
}

export type BackupResult = { ok: true; key: string; reused: boolean } | { ok: false };

/**
 * Stores `raw` under a new, unique backup key. Existing backups are inspected read-only: if one
 * already holds identical text it is reused and nothing is written. Never overwrites a key.
 */
export function backupMalformedValue(
  adapter: StorageAdapter,
  key: string,
  raw: string,
  now: () => Date,
  random: () => number = Math.random,
): BackupResult {
  const prefix = backupPrefix(key);
  try {
    for (const existing of adapter.keys()) {
      if (existing.startsWith(prefix) && adapter.getItem(existing) === raw) {
        return { ok: true, key: existing, reused: true };
      }
    }
    const stamp = now().toISOString().replace(/[:.]/g, "-");
    for (let attempt = 0; attempt < MAX_BACKUP_KEY_ATTEMPTS; attempt++) {
      const suffix = Math.floor(random() * 36 ** 6)
        .toString(36)
        .padStart(6, "0");
      const candidate = `${prefix}${stamp}-${suffix}`;
      if (adapter.getItem(candidate) !== null) continue; // never overwrite
      adapter.setItem(candidate, raw);
      return adapter.getItem(candidate) === raw
        ? { ok: true, key: candidate, reused: false }
        : { ok: false };
    }
  } catch {
    // storage refused — fall through
  }
  return { ok: false };
}

function preserved<T>(schema: StoreSchema<T>, status: ReadStatus): ReadOutcome<T> {
  return { data: schema.empty(), rev: 0, status, dropped: 0, writable: false };
}

/** Reads and classifies the stored value for `schema.key`. Never throws. */
export function readStore<T>(
  adapter: StorageAdapter,
  schema: StoreSchema<T>,
  now: () => Date,
  random: () => number = Math.random,
): ReadOutcome<T> {
  let raw: string | null;
  try {
    raw = adapter.getItem(schema.key);
  } catch {
    return preserved(schema, "memory-only");
  }
  if (raw === null) {
    return { data: schema.empty(), rev: 0, status: "empty", dropped: 0, writable: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Malformed JSON: back up first; reset only after the backup is confirmed.
    const backup = backupMalformedValue(adapter, schema.key, raw, now, random);
    if (!backup.ok) return preserved(schema, "unreadable");
    try {
      writeEnvelope(adapter, schema, schema.empty(), 0, now);
    } catch {
      return { ...preserved(schema, "unreadable"), backupKey: backup.key };
    }
    return {
      data: schema.empty(),
      rev: 0,
      status: "recovered",
      dropped: 0,
      writable: true,
      backupKey: backup.key,
    };
  }

  const envelope = parseEnvelope(parsed);
  if (!envelope || envelope.v < 1 || envelope.v > schema.version) {
    return preserved(schema, "foreign-version");
  }

  let data = envelope.data;
  let migrated = false;
  for (let version = envelope.v; version < schema.version; version++) {
    const migrate = schema.migrations?.[version];
    if (!migrate) return preserved(schema, "foreign-version");
    try {
      data = migrate(data);
    } catch {
      return preserved(schema, "foreign-version");
    }
    migrated = true;
  }

  const checked = schema.validate(data);
  if (!checked) return preserved(schema, "foreign-version");

  if (migrated) {
    const rev = envelope.rev + 1;
    try {
      writeEnvelope(adapter, schema, checked.data, rev, now);
    } catch {
      return {
        data: checked.data,
        rev,
        status: "memory-only",
        dropped: checked.dropped,
        writable: false,
      };
    }
    return {
      data: checked.data,
      rev,
      status: "migrated",
      dropped: checked.dropped,
      writable: true,
    };
  }

  return {
    data: checked.data,
    rev: envelope.rev,
    status: checked.dropped > 0 ? "partial" : "ok",
    dropped: checked.dropped,
    writable: true,
  };
}
