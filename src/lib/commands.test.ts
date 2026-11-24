import { describe, expect, it } from "vitest";
import { applyEffect, COMMANDS, filterCommands, isActive, parseRunCommand } from "./commands";
import { DEFAULT_CONFIG } from "./engine/config";

const byLabel = (label: string) => COMMANDS.find((c) => c.label === label)!;

describe("palette commands", () => {
  it("cover every mode, value, modifier and strictness", () => {
    const labels = COMMANDS.map((c) => c.label);
    for (const l of [
      "mode code", "time 120", "words 10", "quote long", "code 60",
      "punct", "nums", "strict master", "restart", "repeat",
    ]) {
      expect(labels).toContain(l);
    }
    expect(new Set(COMMANDS.map((c) => c.id)).size).toBe(COMMANDS.length);
  });

  it("apply config patches and toggles", () => {
    expect(applyEffect(DEFAULT_CONFIG, byLabel("words 50").effect)).toMatchObject({ mode: "words", words: 50 });
    expect(applyEffect(DEFAULT_CONFIG, byLabel("punct").effect).punct).toBe(true);
    expect(applyEffect({ ...DEFAULT_CONFIG, punct: true }, byLabel("punct").effect).punct).toBe(false);
    expect(applyEffect(DEFAULT_CONFIG, byLabel("restart").effect)).toBe(DEFAULT_CONFIG);
  });

  it("mark the commands matching the current config", () => {
    expect(isActive(DEFAULT_CONFIG, byLabel("time 30"))).toBe(true);
    expect(isActive(DEFAULT_CONFIG, byLabel("mode time"))).toBe(true);
    expect(isActive(DEFAULT_CONFIG, byLabel("time 60"))).toBe(false);
    expect(isActive(DEFAULT_CONFIG, byLabel("strict normal"))).toBe(true);
    expect(isActive(DEFAULT_CONFIG, byLabel("punct"))).toBe(false);
    expect(isActive(DEFAULT_CONFIG, byLabel("restart"))).toBe(false);
  });
});

describe("filterCommands", () => {
  it("returns everything for an empty query", () => {
    expect(filterCommands(COMMANDS, "  ")).toHaveLength(COMMANDS.length);
  });

  it("requires every term and ranks prefix matches first", () => {
    expect(filterCommands(COMMANDS, "words 2").map((c) => c.label)).toEqual(["words 25"]);
    const strict = filterCommands(COMMANDS, "ex").map((c) => c.label);
    expect(strict).toEqual(["strict expert"]);
    const time = filterCommands(COMMANDS, "time").map((c) => c.label);
    expect(time[0]).toBe("time 15");
    expect(time).toContain("mode time");
    expect(time.indexOf("mode time")).toBeGreaterThan(time.indexOf("time 120"));
  });

  it("is case-insensitive", () => {
    expect(filterCommands(COMMANDS, "QUOTE SH").map((c) => c.label)).toEqual(["quote short"]);
  });
});

describe("parseRunCommand", () => {
  it("parses the command bar syntax", () => {
    const r = parseRunCommand("run --mode words --val 25 --punct --strict expert", DEFAULT_CONFIG);
    expect(r).toEqual({
      ok: true,
      config: { ...DEFAULT_CONFIG, mode: "words", words: 25, punct: true, strictness: "expert" },
    });
  });

  it("reads --val against the final mode wherever it appears", () => {
    const r = parseRunCommand("run --val long --mode quote", DEFAULT_CONFIG);
    expect(r.ok && r.config).toMatchObject({ mode: "quote", quoteLength: "long" });
  });

  it("starts from the current config and supports --no-*", () => {
    const current = { ...DEFAULT_CONFIG, punct: true, nums: true };
    const r = parseRunCommand("run --no-punct", current);
    expect(r.ok && r.config).toMatchObject({ punct: false, nums: true, mode: "time" });
  });

  it("reports errors", () => {
    expect(parseRunCommand("go --mode time", DEFAULT_CONFIG)).toMatchObject({ ok: false });
    expect(parseRunCommand("run --mode zen", DEFAULT_CONFIG)).toEqual({ ok: false, error: "unknown mode: zen" });
    expect(parseRunCommand("run --val 45", DEFAULT_CONFIG)).toEqual({ ok: false, error: "invalid --val for time: 45" });
    expect(parseRunCommand("run --strict hard", DEFAULT_CONFIG)).toMatchObject({ ok: false });
    expect(parseRunCommand("run --fast", DEFAULT_CONFIG)).toEqual({ ok: false, error: "unknown flag: --fast" });
    expect(parseRunCommand("run --val", DEFAULT_CONFIG)).toMatchObject({ ok: false });
  });
});
