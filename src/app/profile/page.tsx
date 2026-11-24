import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AccountProvider } from "@/components/account/AccountProvider";
import { RecentRuns } from "@/components/results/RecentRuns";
import { SiteFrame } from "@/components/SiteFrame";
import { formatDuration, profileStats, type ProfileStats } from "@/lib/account/profileStats";
import { getAccount } from "@/lib/account/server";
import { rowToRun, type RunSummary } from "@/lib/account/submit";
import type { Account } from "@/lib/account/types";
import type { TestResultRow } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "profile · termtype" };

const MAX_ROWS = 500;
const RECENT_ROWS = 20;

/** UTC calendar date, so server and browser render the same text. */
function dateOf(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "--";
}

function Stat({ label, value, testId }: { label: string; value: ReactNode; testId: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-text-muted">{label}</span>
      <span data-testid={testId} className="text-2xl text-text-primary tabular-nums">
        {value}
      </span>
    </div>
  );
}

function ProfileView({ account, stats, recent }: { account: Account; stats: ProfileStats; recent: RunSummary[] }) {
  return (
    <div data-testid="profile" className="flex flex-col gap-10">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 data-testid="profile-username" className="text-3xl text-accent">
          @{account.username ?? "new-user"}
        </h1>
        <span className="text-sm text-text-muted">joined {dateOf(account.joinedAt)}</span>
      </div>

      <section className="flex flex-wrap gap-x-12 gap-y-4">
        <Stat label="tests completed" value={stats.tests} testId="profile-tests" />
        <Stat label="time typing" value={formatDuration(stats.totalSeconds)} testId="profile-time" />
        <Stat label="avg wpm (last 10)" value={stats.recentAvgWpm ?? "--"} testId="profile-avg-wpm" />
        <Stat
          label="avg acc (last 10)"
          value={stats.recentAvgAccuracy === null ? "--" : `${stats.recentAvgAccuracy}%`}
          testId="profile-avg-acc"
        />
      </section>

      <section>
        <h2 className="mb-3 text-xs text-text-muted">personal bests</h2>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-bg-surface sm:grid-cols-4">
          {stats.bests.map(({ category, best }) => (
            <div key={category.id} data-testid={`pb-${category.id}`} className="bg-bg-primary px-4 py-3">
              <div className="text-xs text-text-muted">{category.label}</div>
              {best ? (
                <>
                  <div className="text-2xl text-text-primary tabular-nums">{best.wpm}</div>
                  <div className="text-xs text-text-muted tabular-nums">
                    {best.accuracy}% · {dateOf(best.createdAt)}
                  </div>
                </>
              ) : (
                <div className="text-2xl text-text-muted">--</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        {recent.length > 0 ? (
          <RecentRuns runs={recent} source="profile" title="recent runs" />
        ) : (
          <p data-testid="profile-empty" className="text-sm text-text-muted">
            no saved runs yet -{" "}
            <Link href="/" className="text-accent hover:text-text-primary">
              [start typing]
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}

async function ProfileContent() {
  const account = await getAccount();
  if (!account) redirect("/login?next=/profile");

  let rows: TestResultRow[] = [];
  if (account.username) {
    const supabase = await createClient();
    const { data } = (await supabase
      ?.from("test_results")
      .select("*")
      .eq("user_id", account.userId)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS)) ?? { data: null };
    rows = data ?? [];
  }

  return (
    <AccountProvider account={account}>
      <SiteFrame>
        <ProfileView account={account} stats={profileStats(rows)} recent={rows.slice(0, RECENT_ROWS).map(rowToRun)} />
      </SiteFrame>
    </AccountProvider>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <SiteFrame>
          <div className="h-64" aria-hidden />
        </SiteFrame>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
