import type { TestResultRow } from "@/lib/supabase/database.types";

export interface Category {
  id: string;
  label: string;
  mode: string;
  /** Sub-mode to match, or null for any (quotes). */
  subMode: string | null;
}

/** Personal-best categories shown on the profile, in display order. */
export const PB_CATEGORIES: readonly Category[] = [
  ...["15", "30", "60", "120"].map((s) => ({ id: `time-${s}`, label: `time ${s}`, mode: "time", subMode: s })),
  ...["10", "25", "50", "100"].map((s) => ({ id: `words-${s}`, label: `words ${s}`, mode: "words", subMode: s })),
  { id: "quote", label: "quote", mode: "quote", subMode: null },
  ...["15", "30", "60"].map((s) => ({ id: `code-${s}`, label: `code ${s}`, mode: "code", subMode: `code_${s}` })),
];

export interface PersonalBest {
  category: Category;
  wpm: number;
  accuracy: number;
  createdAt: string;
}

export interface ProfileStats {
  tests: number;
  totalSeconds: number;
  /** Averages over the 10 most recent runs; null with no runs. */
  recentAvgWpm: number | null;
  recentAvgAccuracy: number | null;
  bests: { category: Category; best: PersonalBest | null }[];
}

type StatRow = Pick<TestResultRow, "mode" | "sub_mode" | "wpm" | "accuracy" | "duration_sec" | "created_at">;

/** Best = highest WPM, then accuracy, then the earliest run. */
function better(a: StatRow, b: StatRow): boolean {
  if (a.wpm !== b.wpm) return a.wpm > b.wpm;
  if (Number(a.accuracy) !== Number(b.accuracy)) return Number(a.accuracy) > Number(b.accuracy);
  return a.created_at < b.created_at;
}

/** Profile numbers from a user's saved runs (any order). */
export function profileStats(rows: readonly StatRow[]): ProfileStats {
  const newestFirst = [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const recent = newestFirst.slice(0, 10);
  const avg = (values: number[]) =>
    values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
  const recentAvgWpm = avg(recent.map((r) => r.wpm));
  const recentAvgAccuracy = avg(recent.map((r) => Number(r.accuracy)));

  return {
    tests: rows.length,
    totalSeconds: rows.reduce((s, r) => s + r.duration_sec, 0),
    recentAvgWpm: recentAvgWpm === null ? null : Math.round(recentAvgWpm),
    recentAvgAccuracy: recentAvgAccuracy === null ? null : Math.round(recentAvgAccuracy * 10) / 10,
    bests: PB_CATEGORIES.map((category) => {
      let best: StatRow | null = null;
      for (const r of rows) {
        if (r.mode !== category.mode) continue;
        if (category.subMode !== null && r.sub_mode !== category.subMode) continue;
        if (!best || better(r, best)) best = r;
      }
      return {
        category,
        best: best
          ? { category, wpm: best.wpm, accuracy: Number(best.accuracy), createdAt: best.created_at }
          : null,
      };
    }),
  };
}

/** `1h 02m`, `4m 05s`, `45s`. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}
