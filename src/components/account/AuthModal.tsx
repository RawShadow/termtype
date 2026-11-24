"use client";

import { Dialog } from "@/components/Dialog";
import { AuthForm } from "./AuthForm";

/** Sign in without leaving the page (used from the results screen). */
export function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  return (
    <Dialog label="Sign in" testId="auth-modal" onClose={onClose}>
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-text-primary">sign in to save this run</span>
        <button
          type="button"
          onClick={onClose}
          data-testid="auth-modal-close"
          className="rounded px-1 text-text-primary/70 outline-none hover:text-text-primary focus-visible:bg-bg-primary/60"
        >
          [esc]
        </button>
      </div>
      <AuthForm next="/" onSuccess={onSuccess} />
    </Dialog>
  );
}
