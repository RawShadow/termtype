"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Toast, type ToastState } from "@/components/Toast";
import { submitRun } from "@/lib/account/runs";
import {
  describeSyncReport,
  PENDING_SYNC_KEY,
  planSync,
  SYNC_DISMISSED_KEY,
  syncRuns,
} from "@/lib/account/sync";
import type { Account } from "@/lib/account/types";
import type { GuestRun } from "@/lib/history/guestRuns";
import { forgetGuestRuns, readGuestRuns } from "@/lib/history/guestRunsStore";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AuthModal } from "./AuthModal";
import { UsernameModal } from "./UsernameModal";

interface AccountContextValue {
  /** False when Supabase env is missing: the app is guest-only. */
  configured: boolean;
  account: Account | null;
  /** Opens the sign-in modal; `pendingRunId` is auto-synced once signed in. */
  openAuth: (options?: { pendingRunId?: string }) => void;
  signOut: (redirectTo?: string) => Promise<void>;
  /** Guest runs saved to the account by sync during this visit. */
  syncedRunIds: ReadonlySet<string>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

/** Account state, or null outside a provider (e.g. the static loading shell). */
export function useAccount(): AccountContextValue | null {
  return useContext(AccountContext);
}

const TOAST_MS = 6000;

function storageGet(store: () => Storage, key: string): string | null {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}
function storageSet(store: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) store().removeItem(key);
    else store().setItem(key, value);
  } catch {
    // Storage unavailable (private mode etc.): skip.
  }
}
const local = () => window.localStorage;
const session = () => window.sessionStorage;

/**
 * Provides the server-resolved account to the page and owns the account UI:
 * the sign-in modal, first-login username onboarding, and guest-run sync.
 */
export function AccountProvider({ account, children }: { account: Account | null; children: ReactNode }) {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [authOpen, setAuthOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [syncedRunIds, setSyncedRunIds] = useState<ReadonlySet<string>>(() => new Set());
  const markSynced = useCallback((ids: readonly string[]) => {
    if (ids.length) setSyncedRunIds((prev) => new Set([...prev, ...ids]));
  }, []);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const currentUserId = useRef<string | null>(account?.userId ?? null);
  const syncedFor = useRef<string | null>(null);

  const showToast = useCallback((next: ToastState | null, autoHide = true) => {
    clearTimeout(toastTimer.current);
    setToast(next);
    if (next && autoHide) toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => {
    currentUserId.current = account?.userId ?? null;
  }, [account?.userId]);

  // The server-rendered account is the source of truth: refresh it whenever
  // the session changes here or in another tab.
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, sessionData) => {
      const userId = sessionData?.user.id ?? null;
      if ((event === "SIGNED_IN" || event === "SIGNED_OUT") && userId !== currentUserId.current) {
        router.refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  const syncOthers = useCallback(
    async (runs: GuestRun[]) => {
      showToast({ message: `syncing ${runs.length} run${runs.length === 1 ? "" : "s"}...` }, false);
      const saved: string[] = [];
      const report = await syncRuns(runs, async (run) => {
        const { outcome } = await submitRun(run);
        if (outcome === "saved") saved.push(run.id);
        return outcome;
      });
      markSynced(saved);
      forgetGuestRuns(report.handledIds);
      showToast({ message: describeSyncReport(report), tone: report.failed ? "error" : "info" });
      router.refresh();
    },
    [router, showToast, markSynced],
  );

  // Once signed in with a username: save the run the user asked to save, then
  // offer to sync any other guest runs.
  useEffect(() => {
    if (!account?.username || syncedFor.current === account.userId || !configured) return;
    syncedFor.current = account.userId;
    const userId = account.userId;

    void (async () => {
      const pendingId = storageGet(local, PENDING_SYNC_KEY);
      storageSet(local, PENDING_SYNC_KEY, null);
      const plan = planSync(readGuestRuns(), pendingId);

      let lead = "";
      if (plan.pending) {
        const result = await submitRun(plan.pending);
        if (result.outcome === "saved") markSynced([plan.pending.id]);
        if (result.outcome !== "error") forgetGuestRuns([plan.pending.id]);
        lead = result.outcome === "saved" ? "run saved to your profile" : `run not saved: ${result.message}`;
        router.refresh();
      }

      const dismissed = storageGet(session, `${SYNC_DISMISSED_KEY}:${userId}`) === "1";
      if (plan.others.length > 0 && !dismissed) {
        const count = plan.others.length;
        showToast(
          {
            message: `${lead ? `${lead} · ` : ""}Found ${count} unsaved guest run${count === 1 ? "" : "s"} —`,
            actions: [
              { label: "Sync to Profile", testId: "sync-accept", onClick: () => void syncOthers(plan.others) },
              {
                label: "Dismiss",
                testId: "sync-dismiss",
                onClick: () => {
                  storageSet(session, `${SYNC_DISMISSED_KEY}:${userId}`, "1");
                  showToast(null);
                },
              },
            ],
          },
          false,
        );
      } else if (lead) {
        showToast({ message: lead, tone: lead.startsWith("run saved") ? "info" : "error" });
      }
    })();
  }, [account, configured, router, showToast, syncOthers, markSynced]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const openAuth = useCallback((options?: { pendingRunId?: string }) => {
    if (options?.pendingRunId) storageSet(local, PENDING_SYNC_KEY, options.pendingRunId);
    setAuthOpen(true);
  }, []);

  const signOut = useCallback(
    async (redirectTo?: string) => {
      const supabase = createClient();
      if (supabase) await supabase.auth.signOut();
      syncedFor.current = null;
      showToast(null);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    },
    [router, showToast],
  );

  const value = useMemo<AccountContextValue>(
    () => ({ configured, account, openAuth, signOut, syncedRunIds }),
    [configured, account, openAuth, signOut, syncedRunIds],
  );

  return (
    <AccountContext.Provider value={value}>
      {children}
      {authOpen && !account && (
        <AuthModal
          // The pending run is kept on close: after "check your inbox", the
          // confirmation link signs the user in and the run still syncs.
          onClose={() => setAuthOpen(false)}
          onSuccess={() => {
            setAuthOpen(false);
            router.refresh();
          }}
        />
      )}
      {account && !account.username && (
        <UsernameModal
          userId={account.userId}
          email={account.email}
          onCreated={() => router.refresh()}
          onSignOut={() => void signOut()}
        />
      )}
      <Toast toast={toast} />
    </AccountContext.Provider>
  );
}
