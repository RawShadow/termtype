import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  describeConfig,
  durationOf,
  isTimed,
  sanitizeConfig,
  subModeOf,
  toCliString,
  withValue,
  type TestConfig,
} from "./config";

const cfg = (patch: Partial<TestConfig>): TestConfig => ({ ...DEFAULT_CONFIG, ...patch });

describe("config", () => {
  it("defaults to time 30, normal strictness, no modifiers", () => {
    expect(DEFAULT_CONFIG).toMatchObject({ mode: "time", time: 30, punct: false, nums: false, strictness: "normal" });
  });

  it("knows which modes are timed and for how long", () => {
    expect(isTimed(cfg({ mode: "time" }))).toBe(true);
    expect(isTimed(cfg({ mode: "code" }))).toBe(true);
    expect(isTimed(cfg({ mode: "words" }))).toBe(false);
    expect(durationOf(cfg({ mode: "time", time: 120 }))).toBe(120);
    expect(durationOf(cfg({ mode: "code", codeTime: 15 }))).toBe(15);
    expect(durationOf(cfg({ mode: "quote" }))).toBeNull();
  });

  it("builds sub-modes in the stored schema shape", () => {
    expect(subModeOf(cfg({ mode: "time", time: 60 }))).toBe("60");
    expect(subModeOf(cfg({ mode: "words", words: 25 }))).toBe("25");
    expect(subModeOf(cfg({ mode: "quote", quoteLength: "short" }))).toBe("short");
    expect(subModeOf(cfg({ mode: "code", codeTime: 30 }))).toBe("code_30");
  });

  it("sets --val per mode and rejects invalid values", () => {
    expect(withValue(cfg({ mode: "words" }), "50")?.words).toBe(50);
    expect(withValue(cfg({ mode: "quote" }), "long")?.quoteLength).toBe("long");
    expect(withValue(cfg({ mode: "time" }), "45")).toBeNull();
    expect(withValue(cfg({ mode: "code" }), "120")).toBeNull();
  });

  it("sanitizes untrusted input field by field", () => {
    expect(sanitizeConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(sanitizeConfig("nope")).toEqual(DEFAULT_CONFIG);
    expect(
      sanitizeConfig({ mode: "words", words: 50, time: 999, punct: "yes", strictness: "master" }),
    ).toEqual({ ...DEFAULT_CONFIG, mode: "words", words: 50, strictness: "master" });
  });

  it("renders the CLI line and a short description", () => {
    const c = cfg({ mode: "words", words: 25, punct: true, strictness: "expert" });
    expect(toCliString(c)).toBe("run --mode words --val 25 --punct --strict expert");
    expect(describeConfig(c)).toBe("words 25 · punct · expert");
    // Modifiers are not shown for modes they don't apply to.
    expect(toCliString(cfg({ mode: "quote", punct: true }))).toBe("run --mode quote --val all");
  });
});
