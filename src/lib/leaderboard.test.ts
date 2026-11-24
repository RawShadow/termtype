import { describe, expect, it } from "vitest";
import type { LeaderboardRow } from "@/lib/supabase/database.types";
import { leaderboardHref, parseLeaderboardParams, splitBoard } from "./leaderboard";

const row = (rank: number, user: string): LeaderboardRow => ({
  rank,
  user_id: user,
  username: user,
  wpm: 200 - rank,
  raw_wpm: 210 - rank,
  accuracy: 95,
  created_at: "2026-11-25T10:00:00+00:00",
});

describe("parseLeaderboardParams", () => {
  it("defaults to time 30s, all-time", () => {
    const p = parseLeaderboardParams({});
    expect(p.category.id).toBe("time-30");
    expect(p.window).toBe("all");
  });

  it("reads category and window, ignoring junk", () => {
    expect(parseLeaderboardParams({ category: "code-30", window: "daily" })).toMatchObject({
      category: { mode: "code", subMode: "code_30" },
      window: "daily",
    });
    expect(parseLeaderboardParams({ category: ["time-15", "x"], window: "weekly" })).toMatchObject({
      category: { id: "time-15" },
      window: "all",
    });
    expect(parseLeaderboardParams({ category: "words-25" }).category.id).toBe("time-30");
  });

  it("builds shareable links", () => {
    expect(leaderboardHref("time-60", "daily")).toBe("/leaderboard?category=time-60&window=daily");
  });
});

describe("splitBoard", () => {
  const top = [row(1, "a"), row(2, "b"), row(3, "c")];

  it("highlights a user inside the top list without pinning", () => {
    expect(splitBoard(top, "b", 3)).toEqual({ top, pinned: null, userRanked: true });
  });

  it("pins a user ranked below the limit", () => {
    const own = row(137, "me");
    expect(splitBoard([...top, own], "me", 3)).toEqual({ top, pinned: own, userRanked: true });
  });

  it("handles guests and unranked users", () => {
    expect(splitBoard(top, null, 3).userRanked).toBe(false);
    expect(splitBoard(top, "nobody", 3)).toEqual({ top, pinned: null, userRanked: false });
  });
});
