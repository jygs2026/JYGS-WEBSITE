import { describe, expect, it } from "vitest";

import {
  adjustmentMessage,
  bagActionMessage,
  clearBagDescription,
  excludedNote,
  itemCount,
  lineLabel,
  quantityChangeMessage,
  quantityLimitHint,
  savedCountNote,
} from "./cart-feedback";

const LABEL = "Signature Oversized Tee, Black, M";

describe("cart page wording (M3.3)", () => {
  it("labels lines and counts items", () => {
    expect(lineLabel("Signature Oversized Tee", "Black", "M")).toBe(LABEL);
    expect(lineLabel("Item no longer available", null, null)).toBe("Item no longer available");
    expect(itemCount(1)).toBe("1 item");
    expect(itemCount(0)).toBe("0 items");
    expect(itemCount(12)).toBe("12 items");
  });

  it("explains the quantity limit and adjusted lines", () => {
    expect(quantityLimitHint(10)).toBe("Maximum 10 per size.");
    expect(quantityLimitHint(2)).toBe("Only 2 available (demo stock).");
    expect(adjustmentMessage({ from: 5, to: 2, reason: "stock" })).toBe(
      "You had 5 — only 2 available now (demo stock).",
    );
    expect(adjustmentMessage({ from: 14, to: 10, reason: "max" })).toBe(
      "You had 14 — the maximum is 10 per size.",
    );
  });

  it("reports success only for saved quantity changes", () => {
    expect(quantityChangeMessage({ ok: true, quantity: 3, limit: 10 }, LABEL)).toEqual({
      tone: "success",
      text: `${LABEL}: quantity 3.`,
    });
    const failures = [
      { ok: false, reason: "limit_reached", quantity: 2, limit: 2 },
      { ok: false, reason: "sold_out", quantity: 1, limit: 0 },
      { ok: false, reason: "unavailable", quantity: 1, limit: 0 },
      { ok: false, reason: "not_in_cart", quantity: 0, limit: 10 },
      { ok: false, reason: "invalid_quantity", quantity: 1, limit: 10 },
      { ok: false, reason: "lock_timeout" },
      { ok: false, reason: "storage_error" },
    ] as const;
    for (const failure of failures) {
      const message = quantityChangeMessage(failure, LABEL);
      expect(message.tone, failure.reason).toBe("error");
      expect(message.text, failure.reason).not.toMatch(/quantity \d+\.$/);
    }
    expect(quantityChangeMessage(failures[5], LABEL).text).toContain("another tab");
    expect(quantityChangeMessage(failures[6], LABEL).text).toBe(
      "Couldn't update your bag. Please try again.",
    );
  });

  it("remove / clear messages never claim success on failure", () => {
    expect(bagActionMessage({ ok: true }, { kind: "remove", label: LABEL }).text).toBe(
      `Removed ${LABEL} from your bag.`,
    );
    expect(bagActionMessage({ ok: true }, { kind: "clear" }).text).toBe(
      "Your bag has been cleared.",
    );
    const failed = bagActionMessage(
      { ok: false, reason: "storage_error" },
      { kind: "remove", label: LABEL },
    );
    expect(failed).toEqual({ tone: "error", text: `Couldn't remove ${LABEL}. Please try again.` });
    expect(bagActionMessage({ ok: false, reason: "storage_error" }, { kind: "clear" }).text).toBe(
      "Couldn't clear your bag. Please try again.",
    );
    expect(bagActionMessage({ ok: false, reason: "lock_timeout" }, { kind: "clear" }).tone).toBe(
      "error",
    );
  });

  it("summary notes for excluded lines and saved vs counted units", () => {
    expect(excludedNote(0)).toBeNull();
    expect(excludedNote(1)).toBe("1 item isn't available and isn't included in the subtotal.");
    expect(excludedNote(2)).toBe("2 items aren't available and aren't included in the subtotal.");
    expect(savedCountNote(4, 4)).toBeNull();
    expect(savedCountNote(7, 4)).toContain("Your saved bag has 7 items (shown on the bag icon)");
  });

  it("a change kept only for this visit (not saved) never reads as saved", () => {
    const qty = quantityChangeMessage({ ok: true, quantity: 3, limit: 10 }, LABEL, false);
    expect(qty.tone).toBe("info");
    expect(qty.text).toBe(
      `${LABEL}: quantity 3 for this visit only — it couldn't be saved in this browser.`,
    );
    expect(bagActionMessage({ ok: true }, { kind: "remove", label: LABEL }, false).text).toBe(
      `Removed ${LABEL} from your bag for this visit only — it couldn't be saved in this browser.`,
    );
    expect(bagActionMessage({ ok: true }, { kind: "clear" }, false).text).toContain(
      "for this visit only",
    );
  });

  it("clear-bag wording matches the page's item count and names extra saved items", () => {
    expect(clearBagDescription(3, 3)).toBe(
      "This removes all 3 items from your bag. It can't be undone.",
    );
    expect(clearBagDescription(1, 1)).toBe(
      "This removes the 1 item in your bag. It can't be undone.",
    );
    expect(clearBagDescription(9, 3)).toBe(
      "This removes everything in your bag: 3 items in your subtotal and 6 saved items that are unavailable or over the current limit. It can't be undone.",
    );
    expect(clearBagDescription(2, 1)).toBe(
      "This removes everything in your bag: 1 item in your subtotal and 1 saved item that is unavailable or over the current limit. It can't be undone.",
    );
    expect(clearBagDescription(2, 0)).toBe(
      "This removes everything in your bag: 2 saved items that are unavailable or over the current limit. It can't be undone.",
    );
  });
});
