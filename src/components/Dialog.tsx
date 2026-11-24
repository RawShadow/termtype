"use client";

import type { ReactNode } from "react";

interface DialogProps {
  label: string;
  testId: string;
  /** Omit to make the dialog non-dismissable (no Esc / backdrop close). */
  onClose?: () => void;
  children: ReactNode;
}

/** Centered terminal-style panel over a dimmed backdrop. */
export function Dialog({ label, testId, onClose, children }: DialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg-primary/75 px-4 pt-[12vh] pb-8 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (onClose && e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-testid={testId}
        className="w-full max-w-md animate-fade-in rounded-md border border-text-muted/30 bg-bg-surface text-sm"
      >
        {children}
      </div>
    </div>
  );
}
