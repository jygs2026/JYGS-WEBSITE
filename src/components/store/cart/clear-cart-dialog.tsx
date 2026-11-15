"use client";

import { useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { bagActionMessage, clearBagDescription, type Feedback } from "@/lib/cart/cart-feedback";

/**
 * "Clear bag" with confirmation. Cancel is focused first; Escape and Cancel close without
 * changes and focus returns to the trigger. The dialog only closes after the bag was actually
 * cleared; a failure is shown inside the dialog (never reported as success).
 * Clearing keeps the wishlist → bag operation journal (see clearCart).
 */
export function ClearCartDialog({
  storedUnits,
  countedUnits,
  onClearStart,
  onClearEnd,
  onAnnounce,
}: {
  /** Saved units (everything that will be removed). */
  storedUnits: number;
  /** Units counted in the subtotal (the page heading's "items"). */
  countedUnits: number;
  /** Called before clearing, so the page can plan where focus goes once the bag is empty. */
  onClearStart: () => void;
  onClearEnd: (cleared: boolean) => void;
  onAnnounce: (feedback: Feedback) => void;
}) {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      onClearStart();
      const result = await cart.clear();
      const feedback = bagActionMessage(result, { kind: "clear" }, cart.isPersisted());
      onClearEnd(result.ok);
      if (result.ok) setOpen(false);
      else setError(feedback.text);
      onAnnounce(feedback); // "cleared" only after the bag was actually cleared
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="link"
          className="h-11 px-0 text-xs font-semibold tracking-label uppercase"
        >
          Clear bag
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onEscapeKeyDown={(e) => pending && e.preventDefault()}>
        <AlertDialogTitle>Clear your bag?</AlertDialogTitle>
        <AlertDialogDescription>
          {clearBagDescription(storedUnits, countedUnits)}
        </AlertDialogDescription>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel asChild>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-none"
              disabled={pending}
            >
              Cancel
            </Button>
          </AlertDialogCancel>
          <Button type="button" className="h-11 rounded-none" disabled={pending} onClick={confirm}>
            {pending ? "Clearing…" : "Clear bag"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
