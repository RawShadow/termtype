import type { FailReason } from "@/lib/engine/types";
import type { SubmitResult } from "./runs";

/** What the results screen says about where a finished run was stored. */
export type SaveState =
  /** Supabase not configured: runs only live in this browser. */
  | { kind: "local-only" }
  /** Signed out: kept locally; can sign in to save it (not for failed runs). */
  | { kind: "guest"; canSignIn: boolean }
  /** Signed in but no username yet: kept locally until onboarding. */
  | { kind: "needs-username" }
  | { kind: "failed-run" }
  | { kind: "saving" }
  /** Finished as a guest, then signed in: waiting for the sync. */
  | { kind: "syncing" }
  | { kind: "saved" }
  | { kind: "not-saved"; message: string };

export interface SaveStateInput {
  configured: boolean;
  signedIn: boolean;
  hasUsername: boolean;
  failReason: FailReason | null;
  /** Result of saving this run directly from the arena, if attempted. */
  submitResult: SubmitResult | undefined;
  /** The provider synced this run (pending "log in to save score" flow). */
  synced: boolean;
  /** The run is still in the local guest history. */
  inGuestHistory: boolean;
}

export function resolveSaveState(input: SaveStateInput): SaveState {
  if (!input.configured) return { kind: "local-only" };
  if (!input.signedIn) return { kind: "guest", canSignIn: input.failReason === null };
  if (!input.hasUsername) return { kind: "needs-username" };
  if (input.failReason) return { kind: "failed-run" };
  if (input.submitResult) {
    return input.submitResult.outcome === "saved"
      ? { kind: "saved" }
      : { kind: "not-saved", message: input.submitResult.message ?? "unknown error" };
  }
  if (input.synced) return { kind: "saved" };
  if (input.inGuestHistory) return { kind: "syncing" };
  return { kind: "saving" };
}
