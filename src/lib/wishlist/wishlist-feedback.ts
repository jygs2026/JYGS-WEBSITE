/**
 * Customer-facing wording for the wishlist (M3.4): heart labels and announcements, row notes,
 * move-to-bag and recovery messages. Pure functions (unit-tested).
 *
 * Heart labels state the current status first, then what a click will do, so screen-reader users
 * can tell "not saved", "saved in this colour" and "saved in another colour" apart. The heart is
 * a plain button (no aria-pressed): its name changes with its state.
 */
import type { RepositoryFailure } from "@/lib/cart/cart-repository";

import type { SafeHeartOutcome, SafeRemoveOutcome } from "./heart-action";
import type { MoveResult } from "./move-to-cart";
import type { WishlistItemStatus } from "./resolve-wishlist";

export type HeartState = "loading" | "none" | "saved" | "other-colour";

export interface HeartView {
  state: HeartState;
  label: string;
  /** Short visible tooltip (title), e.g. "Saved in Black". */
  tooltip: string;
}

/**
 * Heart view for a card showing `cardColour`. `saved` describes the stored item:
 * undefined = not saved; `colourName` null = saved without a colour.
 */
export function heartView(input: {
  ready: boolean;
  productName: string;
  cardColour: string;
  saved?: { sameColour: boolean; colourName: string | null; hasColour: boolean };
}): HeartView {
  const { productName: name, cardColour } = input;
  if (!input.ready) {
    return { state: "loading", label: `${name}, wishlist loading.`, tooltip: "Wishlist loading" };
  }
  const saved = input.saved;
  if (!saved) {
    return {
      state: "none",
      label: `${name}, not in wishlist. Save in ${cardColour}.`,
      tooltip: "Save to wishlist",
    };
  }
  if (saved.sameColour) {
    return {
      state: "saved",
      label: `${name}, saved in ${cardColour}. Remove from wishlist.`,
      tooltip: `Saved in ${cardColour}`,
    };
  }
  if (!saved.hasColour) {
    return {
      state: "other-colour",
      label: `${name}, saved without a colour. Save in ${cardColour}.`,
      tooltip: "Saved without a colour",
    };
  }
  const other = saved.colourName ?? "another colour";
  return {
    state: "other-colour",
    label: `${name}, saved in ${other}. Change saved colour to ${cardColour}.`,
    tooltip: `Saved in ${other}`,
  };
}

const NOT_SAVED = " for this visit only — it couldn't be saved in this browser.";
const withPersistence = (text: string, persisted: boolean) =>
  persisted ? `${text}.` : `${text}${NOT_SAVED}`;

const CHANGED_ELSEWHERE = "Your wishlist changed in another tab — please check and try again.";
const MOVE_IN_PROGRESS =
  "This item is being moved to your bag in another tab. Try again in a moment.";

function failureText(result: RepositoryFailure): string {
  return result.reason === "lock_timeout"
    ? "Your wishlist is busy in another tab. Please try again."
    : "Couldn't update your wishlist. Please try again.";
}

export interface WishlistMessage {
  tone: "success" | "info" | "error";
  text: string;
}

/** Announcement for a heart click — always what ACTUALLY happened. */
export function heartMessage(
  result: { ok: true; outcome: SafeHeartOutcome } | RepositoryFailure,
  names: { product: string; cardColour: string; fromColour: string | null },
  persisted = true,
): WishlistMessage {
  if (!result.ok) return { tone: "error", text: failureText(result) };
  const { product, cardColour, fromColour } = names;
  const tone = persisted ? "success" : "info";
  switch (result.outcome.kind) {
    case "saved":
      return {
        tone,
        text: withPersistence(`${product} saved to your wishlist in ${cardColour}`, persisted),
      };
    case "colour-changed":
      return {
        tone,
        text: withPersistence(
          result.outcome.from === null || !fromColour
            ? `${product} is now saved in ${cardColour}`
            : `Saved colour of ${product} changed from ${fromColour} to ${cardColour}`,
          persisted,
        ),
      };
    case "removed":
      return { tone, text: withPersistence(`${product} removed from your wishlist`, persisted) };
    case "already-moved":
      return { tone: "info", text: `${product} was already moved to your bag.` };
    case "move-in-progress":
      return { tone: "info", text: MOVE_IN_PROGRESS };
    case "changed-elsewhere":
    default:
      return { tone: "info", text: CHANGED_ELSEWHERE };
  }
}

/** Message for the wishlist-page Remove. */
export function removeMessage(
  result: { ok: true; outcome: SafeRemoveOutcome } | RepositoryFailure,
  label: string,
  persisted = true,
): WishlistMessage {
  if (!result.ok) return { tone: "error", text: failureText(result) };
  switch (result.outcome.kind) {
    case "removed":
      return {
        tone: persisted ? "success" : "info",
        text: withPersistence(`Removed ${label} from your wishlist`, persisted),
      };
    case "already-moved":
      return { tone: "info", text: `${label} was already moved to your bag.` };
    case "move-in-progress":
      return { tone: "info", text: MOVE_IN_PROGRESS };
    case "changed-elsewhere":
    default:
      return { tone: "info", text: CHANGED_ELSEWHERE };
  }
}

/** Message for Add to Bag from the wishlist (a move). Success only when it really happened. */
export function moveMessage(result: MoveResult, label: string): WishlistMessage {
  switch (result.status) {
    case "moved":
      return result.finishedPrevious
        ? {
            tone: "success",
            text: `${label} was already in your bag from an earlier attempt — removed from your wishlist.`,
          }
        : { tone: "success", text: `Added ${label} to your bag.` };
    case "already-moved":
      // M3.1 "already-moved" = the item is no longer in the wishlist (moved OR removed elsewhere).
      return {
        tone: "info",
        text: "This item is no longer in your wishlist — it was moved or removed in another tab. Nothing was added.",
      };
    case "partial":
      return {
        tone: "error",
        text: "Added to your bag, but we couldn't update your wishlist. It will be tidied up next time.",
      };
    case "in-progress":
      return { tone: "info", text: "This item is being added to your bag in another tab." };
    case "failed":
      switch (result.reason) {
        case "limit_reached":
          return {
            tone: "error",
            text: "Your bag already has the maximum available in this size.",
          };
        case "sold_out":
          return { tone: "error", text: "This size is sold out (demo stock)." };
        case "unavailable":
        case "not_in_cart":
          return { tone: "error", text: "This size isn't available in this colour." };
        case "lock_timeout":
          return { tone: "error", text: "Your bag is busy in another tab. Please try again." };
        default:
          return { tone: "error", text: "Couldn't add to your bag. Please try again." };
      }
  }
}

/** Shown on a row whose interrupted move could not be finished on page load. */
export const RECOVERY_PENDING_NOTE =
  "We couldn't finish moving this item to your bag. Check your bag before adding it again.";

/** Announcement when page-load recovery finished an earlier move. */
export function recoveredMessage(productName: string): string {
  return `${productName} was already added to your bag earlier — removed from your wishlist.`;
}

/** Row note for each item status (null when the row is normal). */
export function statusNote(status: WishlistItemStatus, savedColour: string | null): string | null {
  switch (status) {
    case "no_colour":
      return "No colour was saved for this item. Choose a colour on the product page.";
    case "colour_unavailable":
      return savedColour
        ? `Your saved colour (${savedColour}) is no longer available. Choose another colour on the product page.`
        : "Your saved colour is no longer available. Choose another colour on the product page.";
    case "sold_out":
      return "Sold out in this colour (demo stock).";
    case "unavailable":
      return "No longer available.";
    default:
      return null;
  }
}
