import { describe, expect, it } from "vitest";

import {
  addToBagMessage,
  bagLinkLabel,
  formatBadgeCount,
  limitMessage,
  storageNotice,
  wishlistLinkLabel,
} from "./cart-feedback";

describe("counts", () => {
  it("formats badge counts 1–9 and 9+", () => {
    expect(formatBadgeCount(1)).toBe("1");
    expect(formatBadgeCount(9)).toBe("9");
    expect(formatBadgeCount(10)).toBe("9+");
    expect(formatBadgeCount(57)).toBe("9+");
  });

  it("builds accessible link names", () => {
    expect(bagLinkLabel(0)).toBe("Bag");
    expect(bagLinkLabel(1)).toBe("Bag, 1 item");
    expect(bagLinkLabel(12)).toBe("Bag, 12 items");
    expect(wishlistLinkLabel(0)).toBe("Wishlist");
    expect(wishlistLinkLabel(2)).toBe("Wishlist, 2 items");
  });
});

describe("limitMessage", () => {
  it("is null while more can be added", () => {
    expect(limitMessage(0, 10)).toBeNull();
    expect(limitMessage(9, 10)).toBeNull();
    expect(limitMessage(1, 2)).toBeNull();
    expect(limitMessage(0, 0)).toBeNull(); // sold out is handled by the size selector
  });

  it("explains the 10 maximum and the demo-stock maximum", () => {
    expect(limitMessage(10, 10)?.text).toBe("You have the maximum of 10 in this size in your bag.");
    expect(limitMessage(2, 2)?.text).toBe(
      "You have the maximum available (2) in this size in your bag (demo stock).",
    );
  });

  it("explains a bag holding more than is now available, with a link to review it", () => {
    const m = limitMessage(5, 2);
    expect(m?.text).toBe("Your bag already has 5 — only 2 available in this size (demo stock).");
    expect(m?.link).toEqual({ href: "/cart", label: "Review your bag" });
  });
});

describe("addToBagMessage", () => {
  it("confirms success with a View Bag link", () => {
    expect(addToBagMessage({ ok: true, quantity: 1, limit: 10 })).toEqual({
      tone: "success",
      text: "Added to bag (1 piece of this size in your bag).",
      link: { href: "/cart", label: "View Bag" },
    });
    expect(addToBagMessage({ ok: true, quantity: 3, limit: 10 }).text).toContain("3 pieces");
  });

  it("never implies a persistent save when the bag could only be kept for this visit", () => {
    expect(addToBagMessage({ ok: true, quantity: 1, limit: 10 }, true).text).toBe(
      "Added to bag (1 piece of this size in your bag).",
    );
    const unsaved = addToBagMessage({ ok: true, quantity: 2, limit: 10 }, false);
    expect(unsaved).toEqual({
      tone: "info",
      text: "Added to bag (2 pieces of this size in your bag) for this visit only — it couldn't be saved in this browser.",
      link: { href: "/cart", label: "View Bag" },
    });
    // Failures are unaffected by the persistence flag.
    expect(addToBagMessage({ ok: false, reason: "storage_error" }, false).tone).toBe("error");
  });

  it("explains each refusal", () => {
    expect(
      addToBagMessage({ ok: false, reason: "limit_reached", quantity: 2, limit: 2 }).text,
    ).toContain("maximum available (2)");
    expect(addToBagMessage({ ok: false, reason: "sold_out", quantity: 0, limit: 0 }).text).toBe(
      "This size is sold out (demo stock).",
    );
    expect(addToBagMessage({ ok: false, reason: "unavailable", quantity: 0, limit: 0 }).tone).toBe(
      "error",
    );
    expect(addToBagMessage({ ok: false, reason: "lock_timeout" }).text).toContain("another tab");
    expect(addToBagMessage({ ok: false, reason: "storage_error" }).text).toContain("try again");
  });
});

describe("storageNotice", () => {
  it("is null when saving normally", () => {
    for (const status of ["ok", "empty", "migrated"] as const) {
      expect(storageNotice(status, 0, "bag")).toBeNull();
    }
    expect(storageNotice("partial", 0, "bag")).toBeNull();
  });

  it("explains every non-standard state", () => {
    expect(storageNotice("memory-only", 0, "bag")?.text).toBe(
      "Your bag can't be saved in this browser and will be cleared when you refresh.",
    );
    expect(storageNotice("foreign-version", 0, "bag")?.text).toContain("It has not been deleted");
    expect(storageNotice("unreadable", 0, "wishlist")?.text).toContain(
      "saved wishlist couldn't be read",
    );
    expect(storageNotice("recovered", 0, "bag")?.text).toContain(
      "A copy of the damaged data was kept",
    );
    expect(storageNotice("partial", 1, "bag")?.text).toBe(
      "1 saved item couldn't be restored and has been left out.",
    );
    expect(storageNotice("partial", 3, "bag")?.text).toBe(
      "3 saved items couldn't be restored and have been left out.",
    );
  });
});
