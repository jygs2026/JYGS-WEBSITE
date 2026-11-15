/**
 * Unique ID generation for idempotent operations and tab identity.
 *
 * Order of preference (each step guarded with try/catch):
 *   1. crypto.randomUUID()          — secure contexts (localhost, HTTPS)
 *   2. RFC 4122 v4 from crypto.getRandomValues()
 *   3. time + high-resolution time + Math.random + per-tab counter (unique within a browser profile)
 * If every source fails, throws IdGenerationError — callers must handle it without losing data.
 */

export class IdGenerationError extends Error {
  constructor() {
    super("Unable to generate a unique ID");
    this.name = "IdGenerationError";
  }
}

export interface IdEnvironment {
  crypto?: {
    randomUUID?: () => string;
    getRandomValues?: (array: Uint8Array) => Uint8Array;
  };
  now?: () => number;
  random?: () => number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let counter = 0;

function defaultEnvironment(): IdEnvironment {
  return {
    crypto: typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined,
    now: () =>
      Date.now() * 1000 +
      (typeof performance !== "undefined" ? Math.floor((performance.now() * 1000) % 1000) : 0),
    random: Math.random,
  };
}

function uuidFromBytes(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createId(env: IdEnvironment = defaultEnvironment()): string {
  try {
    const id = env.crypto?.randomUUID?.();
    if (typeof id === "string" && UUID_PATTERN.test(id)) return id;
  } catch {
    // try the next source
  }
  try {
    if (env.crypto?.getRandomValues) {
      const bytes = env.crypto.getRandomValues(new Uint8Array(16));
      if (bytes instanceof Uint8Array && bytes.length === 16) return uuidFromBytes(bytes);
    }
  } catch {
    // try the next source
  }
  try {
    const time = env.now?.();
    const random = env.random?.();
    if (
      typeof time === "number" &&
      Number.isFinite(time) &&
      typeof random === "number" &&
      Number.isFinite(random)
    ) {
      counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
      return `id-${Math.floor(time).toString(36)}-${Math.floor(random * 1e12).toString(36)}-${counter.toString(36)}`;
    }
  } catch {
    // all sources failed
  }
  throw new IdGenerationError();
}

export const isUuid = (value: string) => UUID_PATTERN.test(value);
