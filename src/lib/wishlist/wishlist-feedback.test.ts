import { describe, expect, it } from "vitest";

import {
  heartMessage,
  heartView,
  moveMessage,
  recoveredMessage,
  removeMessage,
  statusNote,
} from "./wishlist-feedback";

const NAME = "Signature Oversized Tee";

describe("heartView — status first, then the action (no aria-pressed)", () => {
  const view = (saved?: { sameColour: boolean; colourName: string | null; hasColour: boolean }) =>
    heartView({ ready: true, productName: NAME, cardColour: "White", saved });

  it("distinguishes all states by name", () => {
    expect(heartView({ ready: false, productName: NAME, cardColour: "White" })).toMatchObject({
      state: "loading",
      label: `${NAME}, wishlist loading.`,
    });
    expect(view()).toMatchObject({
      state: "none",
      label: `${NAME}, not in wishlist. Save in White.`,
    });
    expect(view({ sameColour: true, colourName: "White", hasColour: true })).toMatchObject({
      state: "saved",
      label: `${NAME}, saved in White. Remove from wishlist.`,
      tooltip: "Saved in White",
    });
    expect(view({ sameColour: false, colourName: "Black", hasColour: true })).toMatchObject({
      state: "other-colour",
      label: `${NAME}, saved in Black. Change saved colour to White.`,
      tooltip: "Saved in Black",
    });
    expect(view({ sameColour: false, colourName: null, hasColour: false })).toMatchObject({
      state: "other-colour",
      label: `${NAME}, saved without a colour. Save in White.`,
    });
    expect(view({ sameColour: false, colourName: null, hasColour: true }).label).toBe(
      `${NAME}, saved in another colour. Change saved colour to White.`,
    );
  });
});

describe("heartMessage — always what actually happened", () => {
  const names = { product: NAME, cardColour: "White", fromColour: "Black" };
  const ok = (outcome: Parameters<typeof heartMessage>[0] extends infer R ? R : never) => outcome;

  it("announces each outcome", () => {
    expect(
      heartMessage(ok({ ok: true, outcome: { kind: "saved", colourId: "w" } }), names).text,
    ).toBe(`${NAME} saved to your wishlist in White.`);
    expect(
      heartMessage({ ok: true, outcome: { kind: "colour-changed", from: "b", to: "w" } }, names)
        .text,
    ).toBe(`Saved colour of ${NAME} changed from Black to White.`);
    expect(
      heartMessage(
        { ok: true, outcome: { kind: "colour-changed", from: null, to: "w" } },
        { ...names, fromColour: null },
      ).text,
    ).toBe(`${NAME} is now saved in White.`);
    expect(heartMessage({ ok: true, outcome: { kind: "removed" } }, names).text).toBe(
      `${NAME} removed from your wishlist.`,
    );
    expect(heartMessage({ ok: true, outcome: { kind: "already-moved" } }, names).text).toBe(
      `${NAME} was already moved to your bag.`,
    );
    expect(heartMessage({ ok: true, outcome: { kind: "changed-elsewhere" } }, names).text).toBe(
      "Your wishlist changed in another tab — please check and try again.",
    );
    expect(heartMessage({ ok: true, outcome: { kind: "move-in-progress" } }, names).text).toContain(
      "being moved to your bag in another tab",
    );
  });

  it("failures are errors; unsaved changes say so", () => {
    expect(heartMessage({ ok: false, reason: "lock_timeout" }, names)).toEqual({
      tone: "error",
      text: "Your wishlist is busy in another tab. Please try again.",
    });
    expect(heartMessage({ ok: false, reason: "storage_error" }, names).tone).toBe("error");
    expect(heartMessage({ ok: true, outcome: { kind: "removed" } }, names, false).text).toBe(
      `${NAME} removed from your wishlist for this visit only — it couldn't be saved in this browser.`,
    );
  });
});

describe("page messages", () => {
  it("remove", () => {
    expect(removeMessage({ ok: true, outcome: { kind: "removed" } }, `${NAME}, White`).text).toBe(
      `Removed ${NAME}, White from your wishlist.`,
    );
    expect(removeMessage({ ok: false, reason: "storage_error" }, NAME).tone).toBe("error");
    expect(removeMessage({ ok: true, outcome: { kind: "move-in-progress" } }, NAME).tone).toBe(
      "info",
    );
  });

  it("move to bag: success only when it happened", () => {
    expect(moveMessage({ status: "moved", finishedPrevious: false }, `${NAME}, White, M`)).toEqual({
      tone: "success",
      text: `Added ${NAME}, White, M to your bag.`,
    });
    expect(moveMessage({ status: "partial" }, NAME).tone).toBe("error");
    expect(moveMessage({ status: "in-progress" }, NAME).tone).toBe("info");
    expect(moveMessage({ status: "already-moved" }, NAME).text).toBe(
      "This item is no longer in your wishlist — it was moved or removed in another tab. Nothing was added.",
    );
    for (const reason of [
      "limit_reached",
      "sold_out",
      "unavailable",
      "not_in_cart",
      "invalid_quantity",
      "id_generation",
      "lock_timeout",
      "storage_error",
    ] as const) {
      const m = moveMessage({ status: "failed", reason }, NAME);
      expect(m.tone, reason).toBe("error");
      expect(m.text, reason).not.toMatch(/^Added/);
    }
    expect(recoveredMessage(NAME)).toBe(
      `${NAME} was already added to your bag earlier — removed from your wishlist.`,
    );
  });

  it("status notes", () => {
    expect(statusNote("ok", null)).toBeNull();
    expect(statusNote("no_colour", null)).toBe(
      "No colour was saved for this item. Choose a colour on the product page.",
    );
    expect(statusNote("colour_unavailable", "Black")).toBe(
      "Your saved colour (Black) is no longer available. Choose another colour on the product page.",
    );
    expect(statusNote("colour_unavailable", null)).toContain(
      "Your saved colour is no longer available",
    );
    expect(statusNote("sold_out", null)).toBe("Sold out in this colour (demo stock).");
    expect(statusNote("unavailable", null)).toBe("No longer available.");
  });
});
