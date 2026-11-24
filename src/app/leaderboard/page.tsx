import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountProvider } from "@/components/account/AccountProvider";
import { SiteFrame } from "@/components/SiteFrame";
import { getAccount } from "@/lib/account/server";
import {
  LEADERBOARD_CATEGORIES,
  LEADERBOARD_LIMIT,
  LEADERBOARD_WINDOWS,
  leaderboardHref,
  parseLeaderboardParams,
  splitBoard,
  type LeaderboardCategory,
  type LeaderboardWindow,
} from "@/lib/leaderboard";
import type { LeaderboardRow } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "leaderboard · termtype" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function Tab({ href, active, testId, children }: { href: string; active: boolean; testId: string; children: string }) {
  return (
    <Link
      href={href}
      data-testid={testId}
      aria-current={active ? "page" : undefined}
      className={`rounded px-1 outline-none focus-visible:bg-bg-surface ${
        active ? "text-accent" : "text-text-muted hover:text-text-primary"
      }`}
    >
      [{children}]
    </Link>
  );
}

function Row({ row, isUser }: { row: LeaderboardRow; isUser: boolean }) {
  return (
    <tr
      data-testid="lb-row"
      data-user={isUser || undefined}
      className={`border-b border-bg-surface/60 ${isUser ? "bg-bg-surface/40 text-text-primary" : "text-text-muted"}`}
    >
      <td className="px-3 py-1.5 tabular-nums">#{row.rank}</td>
      <td className={`px-3 py-1.5 ${isUser ? "text-accent" : "text-text-primary"}`}>
        @{row.username}
        {isUser && <span className="ml-2 text-xs text-text-muted">&lt; you</span>}
      </td>
      <td className="px-3 py-1.5 text-right text-text-primary tabular-nums">{row.wpm}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{row.raw_wpm}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{Number(row.accuracy)}%</td>
      {/* UTC calendar date: identical on server and client. */}
      <td className="px-3 py-1.5 tabular-nums">{row.created_at.slice(0, 10)}</td>
    </tr>
  );
}

interface ViewProps {
  category: LeaderboardCategory;
  window: LeaderboardWindow;
  rows: LeaderboardRow[];
  userId: string | null;
  status: "ok" | "unavailable" | "error";
}

function LeaderboardView({ category, window, rows, userId, status }: ViewProps) {
  const { top, pinned, userRanked } = splitBoard(rows, userId);
  return (
    <div data-testid="leaderboard" className="flex flex-col gap-6">
      <h1 className="text-sm text-text-muted">
        <span className="text-accent">~$</span> leaderboard{" "}
        <span className="whitespace-nowrap">--category {category.id}</span>{" "}
        <span className="whitespace-nowrap">--window {window}</span>
      </h1>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm">
        <nav aria-label="Category" className="flex flex-wrap gap-2">
          {LEADERBOARD_CATEGORIES.map((c) => (
            <Tab key={c.id} href={leaderboardHref(c.id, window)} active={c.id === category.id} testId={`lb-tab-${c.id}`}>
              {c.label}
            </Tab>
          ))}
        </nav>
        <nav aria-label="Time window" className="flex gap-2">
          {LEADERBOARD_WINDOWS.map((w) => (
            <Tab key={w.id} href={leaderboardHref(category.id, w.id)} active={w.id === window} testId={`lb-window-${w.id}`}>
              {w.label}
            </Tab>
          ))}
        </nav>
      </div>

      <p className="text-xs text-text-muted">
        personal best per user · accuracy ≥ 90% · {window === "daily" ? "last 24 hours" : "all time"}
      </p>

      {status !== "ok" ? (
        <p data-testid="lb-unavailable" className="text-sm text-error">
          {status === "unavailable"
            ? "leaderboards need accounts to be configured on this server"
            : "could not load the leaderboard - try again"}
        </p>
      ) : top.length === 0 ? (
        <p data-testid="lb-empty" className="text-sm text-text-muted">
          no ranked runs yet -{" "}
          <Link href="/" className="text-accent hover:text-text-primary">
            [start typing]
          </Link>
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table data-testid="lb-table" className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-bg-surface text-xs text-text-primary">
              <tr>
                <th className="px-3 py-1.5 font-normal">rank</th>
                <th className="px-3 py-1.5 font-normal">user</th>
                <th className="px-3 py-1.5 text-right font-normal">wpm</th>
                <th className="px-3 py-1.5 text-right font-normal">raw</th>
                <th className="px-3 py-1.5 text-right font-normal">acc</th>
                <th className="px-3 py-1.5 font-normal">date</th>
              </tr>
            </thead>
            <tbody>
              {top.map((row) => (
                <Row key={row.user_id} row={row} isUser={row.user_id === userId} />
              ))}
              {pinned && (
                <>
                  <tr aria-hidden>
                    <td colSpan={6} className="px-3 py-1 text-center text-text-muted">
                      ···
                    </td>
                  </tr>
                  <Row row={pinned} isUser />
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {status === "ok" && userId && !userRanked && (
        <p data-testid="lb-no-user-run" className="text-xs text-text-muted">
          no ranked run yet in this category - finish a {category.label} test with ≥ 90% accuracy to appear here.
        </p>
      )}
      {status === "ok" && top.length >= LEADERBOARD_LIMIT && (
        <p className="text-xs text-text-muted">showing the top {LEADERBOARD_LIMIT}</p>
      )}
    </div>
  );
}

/** Request-time part: reads the session (which checks the clock) and live data, so it renders inside <Suspense>. */
async function LeaderboardContent({ searchParams }: { searchParams: SearchParams }) {
  // Stop prerendering here: everything below depends on the incoming request.
  await connection();
  const { category, window } = parseLeaderboardParams(await searchParams);
  const account = await getAccount();
  const supabase = await createClient();

  let rows: LeaderboardRow[] = [];
  let status: ViewProps["status"] = supabase ? "ok" : "unavailable";
  if (supabase) {
    const { data, error } = await supabase.rpc("get_leaderboard", {
      p_mode: category.mode,
      p_sub_mode: category.subMode,
      p_window: window,
      p_limit: LEADERBOARD_LIMIT,
      p_user_id: account?.userId,
    });
    if (error) status = "error";
    rows = data ?? [];
  }

  return (
    <AccountProvider account={account}>
      <SiteFrame>
        <LeaderboardView
          category={category}
          window={window}
          rows={rows}
          userId={account?.userId ?? null}
          status={status}
        />
      </SiteFrame>
    </AccountProvider>
  );
}

export default function LeaderboardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <SiteFrame>
          <div className="h-64" aria-hidden />
        </SiteFrame>
      }
    >
      <LeaderboardContent searchParams={searchParams} />
    </Suspense>
  );
}
