import { describe, expect, it, vi } from "vitest";
import { submitRun } from "@/lib/account/runs";
import { DEFAULT_CONFIG, type TestConfig } from "@/lib/engine/config";
import { createInitialState, engineReducer } from "@/lib/engine/reducer";
import { getResult } from "@/lib/engine/results";
import type { EngineAction, EngineState } from "@/lib/engine/types";
import { toGuestRun, type GuestRun } from "@/lib/history/guestRuns";
import { handleSubmit, MAX_BODY_BYTES, type SubmitDeps, type SubmitRequest } from "./handler";
import { toRecordArgs, toSubmission, type Submission } from "./submission";
import { validateSubmission } from "./validate";

const cfg = (patch: Partial<TestConfig>): TestConfig => ({ ...DEFAULT_CONFIG, ...patch });

/**
 * Plays a real test through the engine: types the text correctly at a
 * steady pace (msPerChar) starting at t=1000ms, then lets timed tests run out.
 */
function play(config: TestConfig, msPerChar: number, seed = 7): GuestRun {
  let s: EngineState = createInitialState({ seed, config });
  let now = 1000;
  const act = (a: EngineAction) => {
    s = engineReducer(s, a);
  };
  const finished = () => s.status === "finished";
  while (!finished()) {
    act({ type: "TICK", now });
    if (finished()) break;
    const word = s.words[s.wordIndex];
    const typed = word.typed.length;
    if (typed < word.target.length) act({ type: "CHAR", char: word.target[typed], now });
    else act({ type: "SPACE", now });
    now += msPerChar;
  }
  return toGuestRun(s, getResult(s), Date.UTC(2026, 10, 25, 12));
}

function body(patch: Partial<Submission> = {}, timing: Partial<Submission["timing"]> = {}): Submission {
  const base = toSubmission(play(cfg({ mode: "time", time: 15 }), 120))!;
  return { ...base, ...patch, timing: { ...base.timing, ...timing } };
}

const reasonsOf = (input: unknown) => {
  const r = validateSubmission(input);
  return r.ok ? [] : r.reasons;
};

describe("honest runs from the real engine pass", () => {
  const cases: [string, TestConfig, number][] = [
    ["time 15", cfg({ mode: "time", time: 15 }), 120],
    ["time 30 punct+nums", cfg({ mode: "time", time: 30, punct: true, nums: true }), 90],
    ["words 10", cfg({ mode: "words", words: 10 }), 110],
    ["words 25", cfg({ mode: "words", words: 25 }), 70],
    ["quote short", cfg({ mode: "quote", quoteLength: "short" }), 100],
    ["code 15", cfg({ mode: "code", codeTime: 15 }), 150],
  ];
  for (const [name, config, pace] of cases) {
    it(name, () => {
      const submission = toSubmission(play(config, pace));
      expect(submission).not.toBeNull();
      expect(validateSubmission(JSON.parse(JSON.stringify(submission)))).toEqual({ ok: true, value: submission });
    });
  }

  it("a very fast but legal run (~240 wpm)", () => {
    const run = play(cfg({ mode: "time", time: 15 }), 50);
    expect(run.wpm).toBeGreaterThan(200);
    expect(validateSubmission(toSubmission(run)).ok).toBe(true);
  });
});

describe("rejections", () => {
  it("bad shapes and types", () => {
    expect(reasonsOf(null)).toEqual(["body must be an object"]);
    expect(reasonsOf({ ...body(), mode: "zen" })).toContain("invalid mode");
    expect(reasonsOf({ ...body(), subMode: "45" })).toContain("invalid sub-mode");
    expect(reasonsOf({ ...body(), clientRunId: "../x" })).toContain("invalid run id");
    expect(reasonsOf({ ...body(), modifiers: { punct: "no", nums: false, strictness: "normal" } })).toContain(
      "invalid modifiers",
    );
    expect(reasonsOf({ ...body(), modifiers: { ...body().modifiers, extra: 1 } })).toContain("invalid modifiers");
    expect(reasonsOf({ ...body(), wpm: 80.5 })).toContain("wpm must be an integer");
    expect(reasonsOf({ ...body(), playedAt: "yesterday" })).toContain("playedAt must be an ISO date");
    expect(reasonsOf({ ...body(), timing: undefined })).toContain("missing timing summary");
    expect(reasonsOf(body({}, { perSecondWpm: ["a"] as unknown as number[] }))).toContain("invalid per-second wpm");
  });

  it("ceilings", () => {
    expect(reasonsOf(body({ wpm: 261, rawWpm: 280 }))).toContain("wpm must be 0-260");
    expect(reasonsOf(body({ rawWpm: 301 }))).toContain("raw wpm must be 0-300");
    expect(reasonsOf(body({ wpm: 100, rawWpm: 90 }))).toContain("wpm cannot exceed raw wpm");
    expect(reasonsOf(body({ accuracy: 100.5 }))).toContain("accuracy must be 0-100");
    expect(reasonsOf(body({ consistency: -1 }))).toContain("consistency must be 0-100");
  });

  it("duration: configured length and the ±1.5s tolerance", () => {
    expect(reasonsOf(body({ durationSec: 14 }))).toContain("a 15s test must last 15s");
    const ok = body();
    const start = ok.timing.startTime;
    // 15s test measured as 13.4s: outside tolerance.
    expect(reasonsOf(body({}, { endTime: start + 13_400 }))).toContain("measured time does not match the duration");
    // Within tolerance is fine for the duration check itself.
    expect(reasonsOf(body({}, { endTime: start + 16_400 }))).not.toContain(
      "measured time does not match the duration",
    );
    expect(reasonsOf(body({}, { endTime: start - 5 }))).toContain("test must end after it starts");
    const words = toSubmission(play(cfg({ mode: "words", words: 10 }), 110))!;
    expect(reasonsOf({ ...words, durationSec: 4000 })).toContain("duration must be 1-3600s");
  });

  it("snapshot consistency", () => {
    const ok = body();
    expect(reasonsOf(body({}, { perSecondWpm: ok.timing.perSecondWpm.slice(0, 5) }))).toContain(
      "per-second wpm does not cover the test",
    );
    const inflated = [...ok.timing.perSecondWpm.slice(0, -1), ok.wpm + 40];
    expect(reasonsOf(body({}, { perSecondWpm: inflated }))).toContain("wpm does not match the per-second wpm");
    expect(reasonsOf(body({}, { perSecondWpm: [...ok.timing.perSecondWpm.slice(0, -1), 999] }))).toContain(
      "per-second wpm must be 0-260",
    );
  });

  it("claimed scores that don't match the run", () => {
    const ok = body();
    // Claiming a much higher wpm (and raw) than the snapshots and keystrokes show.
    expect(reasonsOf(body({ wpm: ok.wpm + 30, rawWpm: ok.rawWpm + 30 }))).toContain(
      "wpm does not match the per-second wpm",
    );
    // Raw wpm that the keystroke count can't produce.
    expect(reasonsOf(body({}, { totalKeystrokes: Math.round(ok.timing.totalKeystrokes / 2) }))).toContain(
      "raw wpm does not match the keystroke count",
    );
  });
});

describe("toSubmission / toRecordArgs", () => {
  const run = play(cfg({ mode: "code", codeTime: 15, punct: true, strictness: "expert" }), 150);

  it("drops punct/nums where they don't apply and rounds duration", () => {
    const s = toSubmission({ ...run, durationSec: 14.6 })!;
    expect(s.modifiers).toEqual({ punct: false, nums: false, strictness: "expert" });
    expect(s.durationSec).toBe(15);
    expect(toSubmission({ ...run, durationSec: 0.3 })!.durationSec).toBe(1);
  });

  it("refuses failed runs", () => {
    expect(toSubmission({ ...run, failReason: "master" })).toBeNull();
  });

  it("takes the user id from the caller, not the body", () => {
    const args = toRecordArgs("session-user", { ...toSubmission(run)!, userId: "someone-else" } as Submission);
    expect(args.p_user_id).toBe("session-user");
    expect(args).not.toHaveProperty("userId");
    expect(args).toMatchObject({ p_mode: "code", p_sub_mode: "code_15", p_duration_sec: 15 });
  });
});

describe("handleSubmit", () => {
  const good = body();

  function request(payload: unknown, headers: Record<string, string> = {}): SubmitRequest {
    const all: Record<string, string> = { "content-type": "application/json", host: "termtype.test", ...headers };
    return {
      headers: { get: (name) => all[name.toLowerCase()] ?? null },
      text: async () => (typeof payload === "string" ? payload : JSON.stringify(payload)),
    };
  }

  function deps(patch: Partial<SubmitDeps> = {}): SubmitDeps {
    return {
      getUserId: async () => "user-1",
      save: async () => ({ id: "row-1" }),
      ...patch,
    };
  }

  it("saves a valid run for the session user", async () => {
    const save = vi.fn<NonNullable<SubmitDeps["save"]>>(async () => ({ id: "row-1" }));
    const res = await handleSubmit(request({ ...good, userId: "attacker" }), deps({ save }));
    expect(res).toEqual({ status: 201, body: { id: "row-1" } });
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0]).toMatchObject({ p_user_id: "user-1", p_client_run_id: good.clientRunId });
  });

  it("blocks cross-site requests", async () => {
    expect((await handleSubmit(request(good, { origin: "https://evil.example" }), deps())).status).toBe(403);
    expect((await handleSubmit(request(good, { "sec-fetch-site": "cross-site" }), deps())).status).toBe(403);
    expect((await handleSubmit(request(good, { origin: "http://termtype.test" }), deps())).status).toBe(201);
  });

  it("requires JSON within the size limit", async () => {
    expect((await handleSubmit(request(good, { "content-type": "text/plain" }), deps())).status).toBe(415);
    expect((await handleSubmit(request("{nope"), deps())).status).toBe(400);
    expect((await handleSubmit(request("x".repeat(MAX_BODY_BYTES + 1)), deps())).status).toBe(413);
    expect(
      (await handleSubmit(request(good, { "content-length": String(MAX_BODY_BYTES + 1) }), deps())).status,
    ).toBe(413);
  });

  it("requires a session", async () => {
    expect(await handleSubmit(request(good), deps({ getUserId: async () => null }))).toEqual({
      status: 401,
      body: { error: "sign in to save runs" },
    });
  });

  it("rejects invalid runs with reasons", async () => {
    const res = await handleSubmit(request({ ...good, wpm: 999 }), deps());
    expect(res.status).toBe(422);
    expect(res.body.reasons).toContain("wpm must be 0-260");
  });

  it("reports a missing server key", async () => {
    expect((await handleSubmit(request(good), deps({ save: null }))).status).toBe(503);
  });

  it("maps database errors", async () => {
    const withError = (code: string, message = "boom") => deps({ save: async () => ({ error: { code, message } }) });
    expect((await handleSubmit(request(good), withError("P0001"))).status).toBe(409);
    expect(await handleSubmit(request(good), withError("23514", "violates check"))).toEqual({
      status: 422,
      body: { error: "rejected", reasons: ["violates check"] },
    });
    expect((await handleSubmit(request(good), withError("XX000"))).status).toBe(500);
  });
});

describe("submitRun (client)", () => {
  const run = play(cfg({ mode: "time", time: 15 }), 120);
  const respond = (status: number, json: unknown = {}) =>
    vi.fn(async () => new Response(JSON.stringify(json), { status })) as unknown as typeof fetch;

  it("posts the submission to /api/results", async () => {
    const fetchImpl = respond(201, { id: "row" });
    expect(await submitRun(run, fetchImpl)).toEqual({ outcome: "saved", message: null });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/results");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(toSubmission(run));
  });

  it("maps responses to outcomes", async () => {
    expect(await submitRun(run, respond(422, { error: "rejected", reasons: ["wpm must be 0-260"] }))).toEqual({
      outcome: "rejected",
      message: "wpm must be 0-260",
    });
    expect((await submitRun(run, respond(401))).message).toBe("sign in again");
    expect((await submitRun(run, respond(409))).message).toBe("choose a username first");
    expect(await submitRun(run, respond(503))).toEqual({ outcome: "error", message: "saving is unavailable right now" });
    expect((await submitRun(run, respond(500))).outcome).toBe("error");
    const offline = vi.fn(async () => {
      throw new TypeError("network");
    }) as unknown as typeof fetch;
    expect(await submitRun(run, offline)).toEqual({ outcome: "error", message: "could not reach the server" });
  });

  it("never sends failed runs", async () => {
    const fetchImpl = respond(201);
    expect((await submitRun({ ...run, failReason: "master" }, fetchImpl)).outcome).toBe("rejected");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
