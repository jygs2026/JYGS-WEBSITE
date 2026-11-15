"use client";

import { Info } from "lucide-react";

import { storageNotice, type StorageScope } from "@/lib/cart/cart-feedback";
import type { ReadStatus } from "@/lib/storage/versioned-store";
import { cn } from "@/lib/utils";

/**
 * Explains non-standard storage states (unsaved, recovered, unreadable, other version, partial).
 * Renders nothing while storage is not yet read or is saving normally.
 */
export function StorageNotice({
  ready,
  status,
  dropped,
  scope,
  className,
}: {
  ready: boolean;
  status: ReadStatus;
  dropped: number;
  scope: StorageScope;
  className?: string;
}) {
  const notice = ready ? storageNotice(status, dropped, scope) : null;
  if (!notice) return null;
  return (
    <p
      role="status"
      data-storage-notice={status}
      className={cn(
        "flex items-start gap-2 border border-ink/15 bg-offwhite px-3 py-2.5 text-xs leading-relaxed",
        className,
      )}
    >
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>{notice.text}</span>
    </p>
  );
}
