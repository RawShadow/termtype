import type { LeaderboardRow } from "@/lib/supabase/database.types";

export interface LeaderboardCategory {
  id: string;
  label: string;
  mode: "time" | "code";
  subMode: string;
}

/** Ranked categories (SPEC): Time 15s, Time 30s, Time 60s, Code 30s. */
export const LEADERBOARD_CATEGORIES: readonly LeaderboardCategory[] = [
  { id: "time-15", label: "time 15s", mode: "time", subMode: "15" },
  { id: "time-30", label: "time 30s", mode: "time", subMode: "30" },
  { id: "time-60", label: "time 60s", mode: "time", subMode: "60" },
  { id: "code-30", label: "code 30s", mode: "code", subMode: "code_30" },
];

export type LeaderboardWindow = "daily" | "all";
export const LEADERBOARD_WINDOWS: readonly { id: LeaderboardWindow; label: string }[] = [
  { id: "daily", label: "daily" },
  { id: "all", label: "all-time" },
];

export const LEADERBOARD_LIMIT = 50;
const DEFAULT_CATEGORY = LEADERBOARD_CATEGORIES[1];

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Category and window from the URL, falling back to time 30s / all-time. */
export function parseLeaderboardParams(params: Params): {
  category: LeaderboardCategory;
  window: LeaderboardWindow;
} {
  const id = first(params.category);
  const category = LEADERBOARD_CATEGORIES.find((c) => c.id === id) ?? DEFAULT_CATEGORY;
  const window: LeaderboardWindow = first(params.window) === "daily" ? "daily" : "all";
  return { category, window };
}

export function leaderboardHref(categoryId: string, window: LeaderboardWindow): string {
  return `/leaderboard?category=${categoryId}&window=${window}`;
}

/**
 * Splits the rows from `get_leaderboard` into the visible top list and the
 * signed-in user's own row when it ranks below the limit.
 */
export function splitBoard(
  rows: readonly LeaderboardRow[],
  userId: string | null,
  limit = LEADERBOARD_LIMIT,
): { top: LeaderboardRow[]; pinned: LeaderboardRow | null; userRanked: boolean } {
  const top = rows.filter((r) => r.rank <= limit);
  const own = userId ? (rows.find((r) => r.user_id === userId) ?? null) : null;
  return { top, pinned: own && own.rank > limit ? own : null, userRanked: own !== null };
}
