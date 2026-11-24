import { describe, expect, it } from "vitest";
import { createInitialState, engineReducer } from "@/lib/engine/reducer";
import { getResult } from "@/lib/engine/results";
import {
  addGuestRun,
  GUEST_RUNS_KEY,
  isPersonalBest,
  loadGuestRuns,
  MAX_GUEST_RUNS,
  personalBest,
  removeGuestRuns,
  toGuestRun,
  type GuestRun,
  type StorageLike,
} from "./guestRuns";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

function run(patch: Partial<GuestRun> = {}): GuestRun {
  return {
    id: "r1",
    createdAt: 1000,
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

describe("guest run storage", () => {
  it("starts empty and survives corrupt or wrong-shaped data", () => {
    expect(loadGuestRuns(memoryStorage())).toEqual([]);
    expect(loadGuestRuns(memoryStorage({ [GUEST_RUNS_KEY]: "{not json" }))).toEqual([]);
    expect(loadGuestRuns(memoryStorage({ [GUEST_RUNS_KEY]: '{"a":1}' }))).toEqual([]);
    const mixed = JSON.stringify([run(), { id: 5 }, null]);
    expect(loadGuestRuns(memoryStorage({ [GUEST_RUNS_KEY]: mixed }))).toEqual([run()]);
  });

  it("survives storage that throws", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadGuestRuns(broken)).toEqual([]);
    expect(addGuestRun(broken, run())).toEqual([run()]);
  });

  it("keeps the newest 10 runs, newest first", () => {
    const storage = memoryStorage();
    for (let i = 0; i < 13; i++) addGuestRun(storage, run({ id: `r${i}`, createdAt: i }));
    const runs = loadGuestRuns(storage);
    expect(runs).toHaveLength(MAX_GUEST_RUNS);
    expect(runs[0].id).toBe("r12");
    expect(runs[9].id).toBe("r3");
  });

  it("removes synced runs by id", () => {
    const storage = memoryStorage();
    for (const id of ["a", "b", "c"]) addGuestRun(storage, run({ id }));
    expect(removeGuestRuns(storage, ["a", "c", "missing"]).map((r) => r.id)).toEqual(["b"]);
    expect(loadGuestRuns(storage).map((r) => r.id)).toEqual(["b"]);
  });

  it("replaces a run with the same id instead of duplicating it", () => {
    const storage = memoryStorage();
    addGuestRun(storage, run({ wpm: 50 }));
    addGuestRun(storage, run({ wpm: 60 }));
    expect(loadGuestRuns(storage)).toEqual([run({ wpm: 60 })]);
  });
});

describe("personal bests", () => {
  const runs = [
    run({ id: "a", wpm: 90, accuracy: 95 }),
    run({ id: "b", wpm: 90, accuracy: 98 }),
    run({ id: "c", wpm: 120, failReason: "expert" }),
    run({ id: "d", wpm: 150, subMode: "60" }),
    run({ id: "e", wpm: 100, mode: "words", subMode: "30" }),
  ];

  it("picks the best non-failed run in the same category", () => {
    expect(personalBest(runs, "time", "30")?.id).toBe("b");
    expect(personalBest(runs, "time", "30", "b")?.id).toBe("a");
    expect(personalBest(runs, "quote", "short")).toBeNull();
  });

  it("flags a new personal best only when it beats earlier runs", () => {
    expect(isPersonalBest([...runs, run({ id: "f", wpm: 91 })], run({ id: "f", wpm: 91 }))).toBe(true);
    expect(isPersonalBest(runs, run({ id: "g", wpm: 90 }))).toBe(false);
    expect(isPersonalBest(runs, run({ id: "h", wpm: 200, failReason: "master" }))).toBe(false);
    expect(isPersonalBest([], run({ id: "first" }))).toBe(true);
  });
});

describe("toGuestRun", () => {
  it("captures scores, settings and the timing summary", () => {
    let s = createInitialState({ seed: 3, config: { ...createInitialState({ seed: 3 }).config, punct: true } });
    s = engineReducer(s, { type: "CHAR", char: s.words[0].target[0], now: 100 });
    s = engineReducer(s, { type: "TICK", now: 30_100 });
    const g = toGuestRun(s, getResult(s), 123);
    expect(g).toMatchObject({
      mode: "time",
      subMode: "30",
      modifiers: { punct: true, nums: false, strictness: "normal" },
      durationSec: 30,
      startTime: 100,
      endTime: 30_100,
      totalKeystrokes: 1,
      createdAt: 123,
      failReason: null,
    });
    expect(g.perSecondWpm).toHaveLength(30);
    expect(g.chars).not.toHaveProperty("correctWithSpaces");
  });
});
