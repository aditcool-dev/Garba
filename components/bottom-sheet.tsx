"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  closeLabel?: string;
  stickyHeader?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function BottomSheet({ open, onClose, title, description, closeLabel = "Close", stickyHeader=false, className, children }: BottomSheetProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }

      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#050311]/75 p-0 backdrop-blur-sm sm:p-4 md:items-center"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={cn(
          "custom-scrollbar max-h-[calc(100dvh-1rem)] w-full max-w-xl overflow-y-auto rounded-t-[32px] border border-white/10 bg-[#150f3a] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-20px_70px_rgba(0,0,0,0.38)] sm:rounded-[32px] sm:pb-5",
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title !== undefined ? titleId : undefined}
        aria-label={title === undefined ? "Details" : undefined}
        aria-describedby={description !== undefined ? descriptionId : undefined}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <div className={cn("flex items-start justify-between gap-4",stickyHeader&&"sticky top-0 z-30 bg-[#150f3a] pb-3")}>
          <div className="min-w-0">
            {title !== undefined && <h2 id={titleId} className="display-font text-xl font-bold text-white">{title}</h2>}
            {description !== undefined && <p id={descriptionId} className="mt-1 text-sm leading-6 text-[#aaa8d0]">{description}</p>}
          </div>
          <button ref={closeButtonRef} type="button" className="touch-target -mr-2 -mt-2 rounded-full text-xl text-[#aaa8d0] transition hover:bg-white/10 hover:text-white" onClick={onClose} aria-label={closeLabel}>
            ×
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </section>
    </div>
  );
}
