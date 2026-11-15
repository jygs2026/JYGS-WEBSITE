/**
 * `useSyncExternalStore` bindings for the cart and wishlist that never create the shared session
 * (or touch browser storage) during React rendering.
 *
 * - getSnapshot / getServerSnapshot: render-time, side-effect free. Until the session exists they
 *   return the frozen "not ready" server snapshot.
 * - subscribe: called by React after commit (an effect). It creates the session on first use,
 *   which reads (and if necessary repairs) browser storage, and then notifies the listener so
 *   React re-reads the now-available snapshot.
 */
import type { StoreSnapshot } from "@/lib/storage/external-store";
import type { CartState, WishlistState } from "@/types";

import {
  browserHost,
  CART_SERVER_SNAPSHOT,
  WISHLIST_SERVER_SNAPSHOT,
  type SessionHost,
  type ShoppingSession,
} from "./session";

interface SubscribableStore<T> {
  subscribe(listener: () => void): () => void;
  getSnapshot(): StoreSnapshot<T>;
}

export interface StoreBindings<T> {
  subscribe(listener: () => void): () => void;
  getSnapshot(): StoreSnapshot<T>;
  getServerSnapshot(): StoreSnapshot<T>;
}

export function createStoreBindings<T>(
  host: SessionHost,
  select: (session: ShoppingSession) => SubscribableStore<T>,
  serverSnapshot: StoreSnapshot<T>,
  schedule: (task: () => void) => void = (task) => queueMicrotask(task),
): StoreBindings<T> {
  return {
    subscribe(listener) {
      const existed = host.peek() !== null;
      const session = host.get();
      if (!session) return () => {};
      const unsubscribe = select(session).subscribe(listener);
      // First creation happened after React rendered the "not ready" snapshot: ask React to
      // re-read (it compares snapshots and only re-renders if something changed).
      if (!existed) schedule(listener);
      return unsubscribe;
    },
    getSnapshot() {
      const session = host.peek();
      return session ? select(session).getSnapshot() : serverSnapshot;
    },
    getServerSnapshot() {
      return serverSnapshot;
    },
  };
}

export const cartBindings: StoreBindings<CartState> = createStoreBindings(
  browserHost,
  (s) => s.cart,
  CART_SERVER_SNAPSHOT,
);

export const wishlistBindings: StoreBindings<WishlistState> = createStoreBindings(
  browserHost,
  (s) => s.wishlist,
  WISHLIST_SERVER_SNAPSHOT,
);
