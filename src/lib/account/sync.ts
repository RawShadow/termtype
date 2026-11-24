import type { GuestRun } from "@/lib/history/guestRuns";

/** localStorage key holding the run to auto-sync after "log in to save score". */
export const PENDING_SYNC_KEY = "termtype_pending_sync";
/** sessionStorage key prefix: the sync toast was dismissed for this user in this tab. */
export const SYNC_DISMISSED_KEY = "termtype_sync_dismissed";

/** Guest runs that can be saved to an account (failed strict runs can't). */
export function syncableRuns(runs: readonly GuestRun[]): GuestRun[] {
  return runs.filter((r) => !r.failReason);
}

export interface SyncPlan {
  /** The run the user asked to save from the results screen, if it's still syncable. */
  pending: GuestRun | null;
  /** Everything else that could be synced, newest first. */
  others: GuestRun[];
}

export function planSync(runs: readonly GuestRun[], pendingId: string | null): SyncPlan {
  const syncable = syncableRuns(runs);
  const pending = pendingId ? (syncable.find((r) => r.id === pendingId) ?? null) : null;
  return { pending, others: syncable.filter((r) => r !== pending) };
}

export type SubmitOutcome = "saved" | "rejected" | "error";

export interface SyncReport {
  saved: number;
  rejected: number;
  failed: number;
  /** Runs to remove from localStorage: saved ones, and ones the server will never accept. */
  handledIds: string[];
}

/**
 * Submits runs one at a time. Saved and rejected (invalid) runs are handled
 * and can be cleared locally; network/auth errors leave the run for a retry.
 */
export async function syncRuns(
  runs: readonly GuestRun[],
  submit: (run: GuestRun) => Promise<SubmitOutcome>,
): Promise<SyncReport> {
  const report: SyncReport = { saved: 0, rejected: 0, failed: 0, handledIds: [] };
  for (const run of runs) {
    const outcome = await submit(run);
    if (outcome === "saved") report.saved++;
    else if (outcome === "rejected") report.rejected++;
    else report.failed++;
    if (outcome !== "error") report.handledIds.push(run.id);
  }
  return report;
}

export function describeSyncReport(report: SyncReport): string {
  const parts = [`synced ${report.saved} run${report.saved === 1 ? "" : "s"}`];
  if (report.rejected) parts.push(`${report.rejected} rejected`);
  if (report.failed) parts.push(`${report.failed} failed - try again later`);
  return parts.join(" · ");
}
