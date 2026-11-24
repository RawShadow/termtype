"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAccount } from "@/components/account/AccountProvider";
import { fetchPreviousBest, fetchRecentRuns, type SubmitResult } from "@/lib/account/runs";
import { resolveSaveState, type SaveState } from "@/lib/account/saveState";
import type { RunSummary } from "@/lib/account/submit";
import { describeConfig, getResult, type EngineState } from "@/lib/engine";
import { isPersonalBest, runIdOf } from "@/lib/history/guestRuns";
import { useGuestRuns } from "@/lib/history/guestRunsStore";
import { createClient } from "@/lib/supabase/client";
import { RecentRuns } from "./RecentRuns";
import { WpmChart } from "./WpmChart";

const FAIL_TEXT = {
  expert: "test failed - expert: a word was submitted with an error",
  master: "test failed - master: a wrong key was pressed",
} as const;

function Stat({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-text-muted">{label}</span>
      <span data-testid={testId} className="text-xl text-text-primary tabular-nums">
        {children}
      </span>
    </div>
  );
}

interface ResultsViewProps {
  state: EngineState;
  onNext: () => void;
  onRepeat: () => void;
  /** Outcome of saving this run to the account, once known. */
  submitResult?: SubmitResult;
}

const SAVE_TEXT: Partial<Record<SaveState["kind"], string>> = {
  guest: "kept in this browser",
  "needs-username": "pick a username to save runs - this one is kept in this browser",
  "failed-run": "failed runs aren't saved",
  saving: "saving to profile...",
  syncing: "saving to your profile...",
  saved: "saved to profile",
};

interface RemoteRuns {
  runId: string;
  runs: RunSummary[];
  previousBest: number | null;
}

/** Full post-test readout: headline numbers, WPM chart, detail stats, actions, recent runs. */
export function ResultsView({ state, onNext, onRepeat, submitResult }: ResultsViewProps) {
  const result = getResult(state);
  const ctx = useAccount();
  const account = ctx?.account ?? null;
  const guestRuns = useGuestRuns();
  const runId = runIdOf(state);
  const failed = result.failReason !== null;

  const save = resolveSaveState({
    configured: ctx?.configured ?? false,
    signedIn: account !== null,
    hasUsername: Boolean(account?.username),
    failReason: result.failReason,
    submitResult,
    synced: ctx?.syncedRunIds.has(runId) ?? false,
    inGuestHistory: guestRuns.some((r) => r.id === runId),
  });

  // Signed in and saved: show the account's runs instead of the browser's.
  const [remote, setRemote] = useState<RemoteRuns | null>(null);
  const userId = account?.userId;
  const { mode, subMode } = result;
  useEffect(() => {
    if (save.kind !== "saved" || !userId) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    void Promise.all([
      fetchRecentRuns(supabase, userId),
      fetchPreviousBest(supabase, userId, { id: runId, mode, subMode }),
    ]).then(([runs, previousBest]) => {
      if (!cancelled) setRemote({ runId, runs, previousBest });
    });
    return () => {
      cancelled = true;
    };
  }, [save.kind, userId, runId, mode, subMode]);

  const remoteForRun = remote?.runId === runId ? remote : null;
  const guestCurrent = guestRuns.find((r) => r.id === runId);
  const runs: readonly RunSummary[] = remoteForRun ? remoteForRun.runs : guestRuns;
  const pb = remoteForRun
    ? !failed && (remoteForRun.previousBest === null || result.netWpm > remoteForRun.previousBest)
    : guestCurrent
      ? isPersonalBest(guestRuns, guestCurrent)
      : false;
  const { correct, incorrect, extra, missed } = result.chars;

  return (
    <section data-testid="result" aria-live="polite" className="flex animate-fade-in flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span data-testid="result-status" className={failed ? "text-error" : "text-text-muted"}>
          {failed ? FAIL_TEXT[result.failReason!] : "test complete"}
        </span>
        <span className="text-text-muted">·</span>
        <span className="text-text-muted">{describeConfig(state.config)}</span>
        {pb && (
          <span data-testid="pb-badge" className="rounded bg-bg-surface px-2 text-accent">
            new pb
          </span>
        )}
      </div>

      <div className="grid items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex gap-8 md:flex-col md:gap-4">
          <div className="flex flex-col">
            <span className="text-sm text-text-muted">wpm</span>
            <span
              data-testid="result-wpm"
              className={`text-6xl leading-none tabular-nums ${failed ? "text-error" : "text-text-primary"}`}
            >
              {result.netWpm}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-text-muted">acc</span>
            <span data-testid="result-acc" className="text-4xl leading-none text-accent tabular-nums">
              {result.accuracy}%
            </span>
          </div>
        </div>
        <WpmChart snapshots={state.snapshots} />
      </div>

      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <Stat label="raw" testId="result-raw">
          {result.rawWpm}
        </Stat>
        <Stat label="consistency" testId="result-consistency">
          {result.consistency}%
        </Stat>
        <Stat label="chars (correct/incorrect/extra/missed)" testId="result-chars">
          <span className="text-text-primary">{correct}</span>
          <span className="text-text-muted">/</span>
          <span className="text-error">{incorrect}</span>
          <span className="text-text-muted">/</span>
          <span className="text-error">{extra}</span>
          <span className="text-text-muted">/</span>
          <span className="text-text-muted">{missed}</span>
        </Stat>
        <Stat label="time" testId="result-time">
          {Math.round(result.durationSec * 10) / 10}s
        </Stat>
        {state.quote && (
          <Stat label="quote by" testId="result-quote-author">
            {state.quote.author}
          </Stat>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <button
          type="button"
          data-testid="next-test"
          onClick={onNext}
          className="rounded px-2 py-1 text-text-primary outline-none hover:bg-bg-surface focus-visible:bg-bg-surface"
        >
          [next test <span className="text-text-muted">(tab+enter)</span>]
        </button>
        <button
          type="button"
          data-testid="repeat-test"
          onClick={onRepeat}
          className="rounded px-2 py-1 text-text-primary outline-none hover:bg-bg-surface focus-visible:bg-bg-surface"
        >
          [repeat same text]
        </button>
        {save.kind === "guest" && save.canSignIn && (
          <button
            type="button"
            data-testid="save-cta"
            onClick={() => ctx?.openAuth({ pendingRunId: runId })}
            className="rounded px-2 py-1 text-accent outline-none hover:bg-bg-surface focus-visible:bg-bg-surface"
          >
            [log in to save score]
          </button>
        )}
        {save.kind !== "local-only" && (
          <span
            data-testid="save-status"
            data-state={save.kind}
            className={`self-center text-xs ${
              save.kind === "not-saved" ? "text-error" : save.kind === "saved" ? "text-accent" : "text-text-muted"
            }`}
          >
            {save.kind === "not-saved" ? `not saved: ${save.message}` : SAVE_TEXT[save.kind]}
            {save.kind === "saved" && (
              <Link href="/profile" className="ml-2 text-text-muted hover:text-text-primary">
                [view profile]
              </Link>
            )}
          </span>
        )}
      </div>

      <RecentRuns
        runs={runs}
        currentId={runId}
        currentIsPb={pb}
        source={remoteForRun ? "profile" : "browser"}
      />
    </section>
  );
}
