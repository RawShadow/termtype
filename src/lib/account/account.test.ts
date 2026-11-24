import { describe, expect, it } from "vitest";
import type { GuestRun } from "@/lib/history/guestRuns";
import type { TestResultRow } from "@/lib/supabase/database.types";
import { loginErrorMessage, validateCredentials } from "./credentials";
import { formatDuration, PB_CATEGORIES, profileStats } from "./profileStats";
import { resolveSaveState, type SaveStateInput } from "./saveState";
import { rowToRun, saveErrorMessage, toSubmitArgs } from "./submit";
import { describeSyncReport, isRejection, planSync, syncableRuns, syncRuns } from "./sync";
import { suggestUsername, usernameError, USERNAME_PATTERN } from "./username";

function run(patch: Partial<GuestRun> = {}): GuestRun {
  return {
    id: "r1",
    createdAt: Date.UTC(2026, 10, 24, 12, 0, 0),
    mode: "time",
    subMode: "30",
    modifiers: { punct: false, nums: false, strictness: "normal" },
    wpm: 80,
    rawWpm: 85,
    accuracy: 97.5,
    consistency: 80,
    chars: { correct: 200, incorrect: 3, extra: 0, missed: 1 },
    durationSec: 30,
    failReason: null,
    startTime: 0,
    endTime: 30000,
    totalKeystrokes: 210,
    perSecondWpm: [70, 80],
    ...patch,
  };
}

function row(patch: Partial<TestResultRow> = {}): TestResultRow {
  return {
    id: "uuid",
    user_id: "u1",
    client_run_id: "r1",
    mode: "time",
    sub_mode: "30",
    modifiers: { punct: false, nums: false, strictness: "normal" },
    wpm: 80,
    raw_wpm: 85,
    accuracy: 97.5,
    consistency: 80,
    duration_sec: 30,
    created_at: "2026-11-24T12:00:00+00:00",
    ...patch,
  };
}

describe("usernames", () => {
  it("validate like the database constraint", () => {
    expect(usernameError("ab")).toBe("at least 3 characters");
    expect(usernameError("a".repeat(21))).toBe("at most 20 characters");
    expect(usernameError("bad name")).toBe("letters, numbers and _ only");
    expect(usernameError("Ada_Lovelace_1815")).toBeNull();
  });

  it("suggests a valid name from the email", () => {
    for (const email of ["ada.lovelace@x.io", "a@x.io", "", null, "very-long-name-for-an-email-address@x.io", "__@x"]) {
      expect(suggestUsername(email), String(email)).toMatch(USERNAME_PATTERN);
    }
    expect(suggestUsername("ada.lovelace@x.io")).toBe("ada_lovelace");
  });
});

describe("credentials", () => {
  it("checks email and password before contacting the server", () => {
    expect(validateCredentials("signin", "nope", "x")).toBe("enter a valid email address");
    expect(validateCredentials("signin", "a@b.co", "")).toBe("enter your password");
    expect(validateCredentials("signup", "a@b.co", "short")).toBe("password needs at least 8 characters");
    expect(validateCredentials("signup", " a@b.co ", "longenough")).toBeNull();
  });

  it("maps login error codes and never echoes arbitrary text", () => {
    expect(loginErrorMessage("link")).toContain("expired");
    expect(loginErrorMessage("oauth")).toContain("provider");
    expect(loginErrorMessage("<script>alert(1)</script>")).toBeNull();
    expect(loginErrorMessage(null)).toBeNull();
  });
});

describe("toSubmitArgs", () => {
  it("maps a guest run to the database function's arguments", () => {
    expect(toSubmitArgs(run({ durationSec: 15.84, mode: "words", subMode: "25" }))).toEqual({
      p_client_run_id: "r1",
      p_mode: "words",
      p_sub_mode: "25",
      p_modifiers: { punct: false, nums: false, strictness: "normal" },
      p_wpm: 80,
      p_raw_wpm: 85,
      p_accuracy: 97.5,
      p_consistency: 80,
      p_duration_sec: 16,
      p_played_at: "2026-11-24T12:00:00.000Z",
    });
  });

  it("never sends a zero duration", () => {
    expect(toSubmitArgs(run({ mode: "quote", subMode: "short", durationSec: 0.3 }))?.p_duration_sec).toBe(1);
  });

  it("drops punct/nums for modes they don't apply to", () => {
    const args = toSubmitArgs(
      run({ mode: "code", subMode: "code_30", modifiers: { punct: true, nums: true, strictness: "expert" } }),
    );
    expect(args?.p_modifiers).toEqual({ punct: false, nums: false, strictness: "expert" });
  });

  it("refuses failed runs", () => {
    expect(toSubmitArgs(run({ failReason: "master" }))).toBeNull();
  });
});

describe("rowToRun / saveErrorMessage", () => {
  it("reads a saved row back into a run summary", () => {
    expect(rowToRun(row({ accuracy: 97.5, modifiers: { punct: true, nums: false, strictness: "master" } }))).toEqual({
      id: "r1",
      createdAt: Date.UTC(2026, 10, 24, 12, 0, 0),
      mode: "time",
      subMode: "30",
      modifiers: { punct: true, nums: false, strictness: "master" },
      wpm: 80,
      rawWpm: 85,
      accuracy: 97.5,
      failReason: null,
    });
  });

  it("survives odd modifiers and modes", () => {
    const r = rowToRun(row({ modifiers: null, mode: "zen" }));
    expect(r.modifiers).toEqual({ punct: false, nums: false, strictness: "normal" });
    expect(r.mode).toBe("time");
  });

  it("gives short messages for save errors", () => {
    expect(saveErrorMessage({ code: "23514", message: "violates check" })).toBe("values out of range");
    expect(saveErrorMessage({ code: "28000" })).toBe("sign in again");
    expect(saveErrorMessage({ code: "22023", message: "duration does not match the test length" })).toBe(
      "duration does not match the test length",
    );
    expect(saveErrorMessage(null)).toBe("unknown error");
  });
});

describe("guest sync", () => {
  const runs = [run({ id: "a" }), run({ id: "b", failReason: "expert" }), run({ id: "c" })];

  it("only syncs runs that didn't fail", () => {
    expect(syncableRuns(runs).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("puts the pending run first and keeps the rest", () => {
    expect(planSync(runs, "c")).toEqual({ pending: runs[2], others: [runs[0]] });
    expect(planSync(runs, "b")).toEqual({ pending: null, others: [runs[0], runs[2]] }); // failed run isn't pending
    expect(planSync(runs, null).pending).toBeNull();
    expect(planSync(runs, "gone").others).toHaveLength(2);
  });

  it("clears saved and rejected runs but keeps errored ones for retry", async () => {
    const outcomes = { a: "saved", c: "rejected", d: "error" } as const;
    const report = await syncRuns([run({ id: "a" }), run({ id: "c" }), run({ id: "d" })], async (r) =>
      outcomes[r.id as keyof typeof outcomes],
    );
    expect(report).toEqual({ saved: 1, rejected: 1, failed: 1, handledIds: ["a", "c"] });
    expect(describeSyncReport(report)).toBe("synced 1 run · 1 rejected · 1 failed - try again later");
    expect(describeSyncReport({ saved: 3, rejected: 0, failed: 0, handledIds: [] })).toBe("synced 3 runs");
  });

  it("treats bad-data errors as rejections, not retries", () => {
    expect(isRejection("22023")).toBe(true);
    expect(isRejection("23514")).toBe(true);
    expect(isRejection("28000")).toBe(false);
    expect(isRejection(undefined)).toBe(false);
  });
});

describe("resolveSaveState", () => {
  const base: SaveStateInput = {
    configured: true,
    signedIn: true,
    hasUsername: true,
    failReason: null,
    submitResult: undefined,
    synced: false,
    inGuestHistory: false,
  };

  it("covers every storage outcome", () => {
    expect(resolveSaveState({ ...base, configured: false })).toEqual({ kind: "local-only" });
    expect(resolveSaveState({ ...base, signedIn: false })).toEqual({ kind: "guest", canSignIn: true });
    expect(resolveSaveState({ ...base, signedIn: false, failReason: "master" })).toEqual({
      kind: "guest",
      canSignIn: false,
    });
    expect(resolveSaveState({ ...base, hasUsername: false })).toEqual({ kind: "needs-username" });
    expect(resolveSaveState({ ...base, failReason: "expert" })).toEqual({ kind: "failed-run" });
    expect(resolveSaveState(base)).toEqual({ kind: "saving" });
    expect(resolveSaveState({ ...base, submitResult: { outcome: "saved", message: null } })).toEqual({ kind: "saved" });
    expect(resolveSaveState({ ...base, submitResult: { outcome: "error", message: "offline" } })).toEqual({
      kind: "not-saved",
      message: "offline",
    });
    expect(resolveSaveState({ ...base, inGuestHistory: true })).toEqual({ kind: "syncing" });
    expect(resolveSaveState({ ...base, synced: true, inGuestHistory: true })).toEqual({ kind: "saved" });
  });
});

describe("profileStats", () => {
  it("is empty-safe", () => {
    const s = profileStats([]);
    expect(s).toMatchObject({ tests: 0, totalSeconds: 0, recentAvgWpm: null, recentAvgAccuracy: null });
    expect(s.bests).toHaveLength(PB_CATEGORIES.length);
    expect(s.bests.every((b) => b.best === null)).toBe(true);
  });

  it("totals, averages the 10 most recent, and finds bests per category", () => {
    const rows = [
      ...Array.from({ length: 12 }, (_, i) =>
        row({ wpm: 50 + i, accuracy: 90, created_at: `2026-11-${String(10 + i).padStart(2, "0")}T00:00:00Z` }),
      ),
      row({ mode: "quote", sub_mode: "short", wpm: 99, duration_sec: 9, created_at: "2026-11-01T00:00:00Z" }),
      row({ mode: "quote", sub_mode: "long", wpm: 120, duration_sec: 40, created_at: "2026-11-02T00:00:00Z" }),
      row({ mode: "code", sub_mode: "code_30", wpm: 70, accuracy: 96, created_at: "2026-11-03T00:00:00Z" }),
      row({ mode: "code", sub_mode: "code_30", wpm: 70, accuracy: 98, created_at: "2026-11-04T00:00:00Z" }),
    ];
    const s = profileStats(rows);
    expect(s.tests).toBe(16);
    expect(s.totalSeconds).toBe(12 * 30 + 9 + 40 + 30 + 30);
    // Newest 10 are the time-30 runs with wpm 52..61.
    expect(s.recentAvgWpm).toBe(Math.round((52 + 61) / 2));
    expect(s.recentAvgAccuracy).toBe(90);
    const best = (id: string) => s.bests.find((b) => b.category.id === id)?.best;
    expect(best("time-30")?.wpm).toBe(61);
    expect(best("quote")?.wpm).toBe(120); // any quote length
    expect(best("code-30")).toMatchObject({ wpm: 70, accuracy: 98 }); // tie broken by accuracy
    expect(best("time-60")).toBeNull();
  });

  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(245)).toBe("4m 05s");
    expect(formatDuration(3720)).toBe("1h 02m");
  });
});
