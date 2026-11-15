/**
 * Customer-facing wording for bag/wishlist counts, Add to Bag results and storage states.
 * Pure functions (unit-tested). Demo stock is always labelled as demo data.
 */
import type { ReadStatus } from "@/lib/storage/versioned-store";

import type { CartActionResult } from "./cart-repository";

/** Badge text: whole numbers 1–9, "9+" above. */
export function formatBadgeCount(count: number): string {
  return count > 9 ? "9+" : String(Math.max(0, Math.floor(count)));
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Accessible name for the header bag link. */
export function bagLinkLabel(units: number): string {
  return units > 0 ? `Bag, ${plural(units, "item", "items")}` : "Bag";
}

/** Accessible name for the header / menu wishlist link. */
export function wishlistLinkLabel(count: number): string {
  return count > 0 ? `Wishlist, ${plural(count, "item", "items")}` : "Wishlist";
}

export type FeedbackTone = "success" | "error" | "info";

export interface Feedback {
  tone: FeedbackTone;
  text: string;
  /** Show a link to the bag after the text. */
  link?: { href: string; label: string };
}

const VIEW_BAG = { href: "/cart", label: "View Bag" } as const;
const REVIEW_BAG = { href: "/cart", label: "Review your bag" } as const;

/**
 * Limit explanation for the selected size, or null when more can be added.
 * `inBag` is the stored quantity; `limit` is min(10, available demo stock).
 */
export function limitMessage(inBag: number, limit: number): Feedback | null {
  if (limit <= 0 || inBag < limit) return null;
  if (inBag > limit) {
    return {
      tone: "info",
      text: `Your bag already has ${inBag} — only ${limit} available in this size (demo stock).`,
      link: REVIEW_BAG,
    };
  }
  return {
    tone: "info",
    text:
      limit >= 10
        ? "You have the maximum of 10 in this size in your bag."
        : `You have the maximum available (${limit}) in this size in your bag (demo stock).`,
    link: VIEW_BAG,
  };
}

/**
 * Message for an Add to Bag attempt. `persisted` (read after the add): false when the bag could
 * not be saved in browser storage, so the add lasts for this visit only — never implied as saved.
 */
export function addToBagMessage(result: CartActionResult, persisted = true): Feedback {
  if (result.ok) {
    const added = `Added to bag (${plural(result.quantity, "piece", "pieces")} of this size in your bag)`;
    return {
      tone: persisted ? "success" : "info",
      text: persisted ? `${added}.` : `${added}${NOT_SAVED}`,
      link: VIEW_BAG,
    };
  }
  switch (result.reason) {
    case "limit_reached":
      return (
        limitMessage(result.quantity, result.limit) ?? {
          tone: "error",
          text: `Only ${result.limit} available in this size (demo stock).`,
          link: VIEW_BAG,
        }
      );
    case "sold_out":
      return { tone: "error", text: "This size is sold out (demo stock)." };
    case "unavailable":
    case "not_in_cart":
      return { tone: "error", text: "This size isn't available in this colour." };
    case "invalid_quantity":
      return { tone: "error", text: "Couldn't add to your bag. Please try again." };
    case "lock_timeout":
      return { tone: "error", text: "Your bag is busy in another tab. Please try again." };
    case "storage_error":
    default:
      return { tone: "error", text: "Couldn't add to your bag. Please try again." };
  }
}

export type StorageScope = "bag" | "wishlist";

/**
 * Warning for the current storage state, or null when everything is saving normally.
 * `dropped` is the number of saved entries that could not be restored ("partial").
 */
export function storageNotice(
  status: ReadStatus,
  dropped: number,
  scope: StorageScope,
): Feedback | null {
  const saved = scope === "bag" ? "saved bag" : "saved wishlist";
  switch (status) {
    case "memory-only":
      return {
        tone: "info",
        text: `Your ${scope} can't be saved in this browser and will be cleared when you refresh.`,
      };
    case "foreign-version":
      return {
        tone: "info",
        text: `Your ${saved} was created by a different version of this site and can't be opened here. It has not been deleted. Changes you make now won't be saved after you refresh.`,
      };
    case "unreadable":
      return {
        tone: "info",
        text: `Your ${saved} couldn't be read. It has not been deleted. Changes you make now won't be saved after you refresh.`,
      };
    case "recovered":
      return {
        tone: "info",
        text: `We couldn't read your ${saved}, so it has been reset. A copy of the damaged data was kept.`,
      };
    case "partial":
      return dropped > 0
        ? {
            tone: "info",
            text: `${plural(dropped, "saved item", "saved items")} couldn't be restored and ${dropped === 1 ? "has" : "have"} been left out.`,
          }
        : null;
    default:
      return null;
  }
}

// --- Cart page (M3.3) --------------------------------------------------------------------------

/**
 * Appended to a successful change that could NOT be saved in browser storage (memory-only: the
 * change lasts for this visit only), so it never reads as saved.
 */
const NOT_SAVED = " for this visit only — it couldn't be saved in this browser.";

/** "Signature Oversized Tee, Black, M" — used in button names and announcements. */
export function lineLabel(name: string, colour: string | null, size: string | null): string {
  return [name, colour, size].filter(Boolean).join(", ");
}

/** Item count text, e.g. "1 item", "3 items". */
export function itemCount(units: number): string {
  return plural(units, "item", "items");
}

/** Hint shown under a quantity control when + is disabled at the limit. */
export function quantityLimitHint(limit: number): string {
  return limit >= 10 ? "Maximum 10 per size." : `Only ${limit} available (demo stock).`;
}

/** Explanation for a line whose saved quantity is above what is allowed now. */
export function adjustmentMessage(adjustment: {
  from: number;
  to: number;
  reason: "stock" | "max";
}): string {
  return adjustment.reason === "stock"
    ? `You had ${adjustment.from} — only ${adjustment.to} available now (demo stock).`
    : `You had ${adjustment.from} — the maximum is 10 per size.`;
}

/**
 * Message for a quantity change / "Update to N" on the cart page. Success is only reported when
 * the change was saved (`result.ok`); failures never read as success.
 */
export function quantityChangeMessage(
  result: CartActionResult,
  label: string,
  persisted = true,
): Feedback {
  if (result.ok) {
    return {
      tone: persisted ? "success" : "info",
      text: `${label}: quantity ${result.quantity}${persisted ? "." : NOT_SAVED}`,
    };
  }
  switch (result.reason) {
    case "limit_reached":
      return { tone: "error", text: `${label}: ${quantityLimitHint(result.limit)}` };
    case "sold_out":
      return { tone: "error", text: `${label} is sold out (demo stock).` };
    case "unavailable":
      return { tone: "error", text: `${label} is no longer available.` };
    case "not_in_cart":
      return { tone: "error", text: `${label} is no longer in your bag.` };
    case "lock_timeout":
      return { tone: "error", text: "Your bag is busy in another tab. Please try again." };
    case "invalid_quantity":
    case "storage_error":
    default:
      return { tone: "error", text: "Couldn't update your bag. Please try again." };
  }
}

/** Message for Remove / Clear bag results. */
export function bagActionMessage(
  result: { ok: true } | { ok: false; reason: "lock_timeout" | "storage_error" },
  action: { kind: "remove"; label: string } | { kind: "clear" },
  persisted = true,
): Feedback {
  if (result.ok) {
    const text =
      action.kind === "remove"
        ? `Removed ${action.label} from your bag`
        : "Your bag has been cleared";
    return { tone: persisted ? "success" : "info", text: `${text}${persisted ? "." : NOT_SAVED}` };
  }
  if (result.reason === "lock_timeout") {
    return { tone: "error", text: "Your bag is busy in another tab. Please try again." };
  }
  return {
    tone: "error",
    text:
      action.kind === "remove"
        ? `Couldn't remove ${action.label}. Please try again.`
        : "Couldn't clear your bag. Please try again.",
  };
}

/** Summary note for lines left out of the subtotal (sold out / unavailable). */
export function excludedNote(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? "1 item isn't available and isn't included in the subtotal."
    : `${count} items aren't available and aren't included in the subtotal.`;
}

/**
 * Explains why the header bag count (saved units) differs from the counted units, which happens
 * until the customer updates adjusted lines or removes unavailable ones.
 */
export function savedCountNote(storedUnits: number, countedUnits: number): string | null {
  if (storedUnits === countedUnits) return null;
  return `Your saved bag has ${itemCount(storedUnits)} (shown on the bag icon). ${itemCount(countedUnits)} can be counted right now — update or remove the marked items below.`;
}

/**
 * Clear-bag confirmation text. Uses the same "items" count as the page heading and summary
 * (units counted in the subtotal) and names any extra saved units separately, so the numbers
 * never appear to disagree. Clearing always removes every saved line.
 */
export function clearBagDescription(storedUnits: number, countedUnits: number): string {
  const extra = Math.max(0, storedUnits - countedUnits);
  const end = " It can't be undone.";
  if (extra === 0) {
    return countedUnits === 1
      ? `This removes the 1 item in your bag.${end}`
      : `This removes all ${itemCount(countedUnits)} from your bag.${end}`;
  }
  const saved = `${plural(extra, "saved item", "saved items")} that ${extra === 1 ? "is" : "are"} unavailable or over the current limit`;
  if (countedUnits === 0) return `This removes everything in your bag: ${saved}.${end}`;
  return `This removes everything in your bag: ${itemCount(countedUnits)} in your subtotal and ${saved}.${end}`;
}
