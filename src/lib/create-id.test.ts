import { describe, expect, it } from "vitest";

import { createId, IdGenerationError, isUuid } from "./create-id";

describe("createId", () => {
  it("uses crypto.randomUUID when available", () => {
    const id = createId({ crypto: { randomUUID: () => "123e4567-e89b-42d3-a456-426614174000" } });
    expect(id).toBe("123e4567-e89b-42d3-a456-426614174000");
  });

  it("falls back to getRandomValues and produces a valid UUID v4", () => {
    let seed = 1;
    const id = createId({
      crypto: {
        getRandomValues: (a) => a.map(() => (seed = (seed * 97 + 13) % 256)),
      },
    });
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe("4"); // version nibble
    expect("89ab").toContain(id[19]); // variant nibble
  });

  it("falls back when randomUUID throws or returns garbage", () => {
    const viaThrow = createId({
      crypto: {
        randomUUID: () => {
          throw new Error("insecure context");
        },
        getRandomValues: (a) => a.fill(7),
      },
    });
    expect(isUuid(viaThrow)).toBe(true);
    const viaGarbage = createId({
      crypto: { randomUUID: () => "nope", getRandomValues: (a) => a.fill(9) },
    });
    expect(isUuid(viaGarbage)).toBe(true);
  });

  it("uses the time/random/counter fallback without crypto, staying unique", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++)
      ids.add(createId({ now: () => 1_700_000_000_000, random: () => 0.5 }));
    expect(ids.size).toBe(10_000); // the per-tab counter guarantees uniqueness
  });

  it("throws IdGenerationError when every source fails (callers must handle it)", () => {
    expect(() =>
      createId({
        crypto: {
          randomUUID: () => {
            throw new Error("x");
          },
          getRandomValues: () => {
            throw new Error("y");
          },
        },
        now: () => Number.NaN,
        random: () => Number.NaN,
      }),
    ).toThrow(IdGenerationError);
  });
});
