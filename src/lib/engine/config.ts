export const MODES = ["time", "words", "quote", "code"] as const;
export const TIME_OPTIONS = [15, 30, 60, 120] as const;
export const WORD_OPTIONS = [10, 25, 50, 100] as const;
export const QUOTE_LENGTHS = ["short", "medium", "long", "all"] as const;
export const CODE_TIME_OPTIONS = [15, 30, 60] as const;
export const STRICTNESS_LEVELS = ["normal", "expert", "master"] as const;

export type Mode = (typeof MODES)[number];
export type TimeOption = (typeof TIME_OPTIONS)[number];
export type WordOption = (typeof WORD_OPTIONS)[number];
export type QuoteLength = (typeof QUOTE_LENGTHS)[number];
export type CodeTimeOption = (typeof CODE_TIME_OPTIONS)[number];
export type Strictness = (typeof STRICTNESS_LEVELS)[number];

export interface TestConfig {
  mode: Mode;
  time: TimeOption;
  words: WordOption;
  quoteLength: QuoteLength;
  codeTime: CodeTimeOption;
  punct: boolean;
  nums: boolean;
  strictness: Strictness;
}

export const DEFAULT_CONFIG: TestConfig = {
  mode: "time",
  time: 30,
  words: 25,
  quoteLength: "all",
  codeTime: 30,
  punct: false,
  nums: false,
  strictness: "normal",
};

/** Time and code tests end on a timer; words and quote tests end when the text is done. */
export function isTimed(config: TestConfig): boolean {
  return config.mode === "time" || config.mode === "code";
}

/** Test length in seconds for timed modes, `null` otherwise. */
export function durationOf(config: TestConfig): number | null {
  if (config.mode === "time") return config.time;
  if (config.mode === "code") return config.codeTime;
  return null;
}

/** `--punct` / `--nums` only apply to time and words modes. */
export function supportsModifiers(mode: Mode): boolean {
  return mode === "time" || mode === "words";
}

/** Sub-mode in the shape the `test_results.sub_mode` column expects. */
export function subModeOf(config: TestConfig): string {
  switch (config.mode) {
    case "time":
      return String(config.time);
    case "words":
      return String(config.words);
    case "quote":
      return config.quoteLength;
    case "code":
      return `code_${config.codeTime}`;
  }
}

/** The value shown after `--val` for the current mode. */
export function valueOf(config: TestConfig): string {
  switch (config.mode) {
    case "time":
      return String(config.time);
    case "words":
      return String(config.words);
    case "quote":
      return config.quoteLength;
    case "code":
      return String(config.codeTime);
  }
}

/** Options for `--val` in a given mode. */
export function valueOptions(mode: Mode): readonly string[] {
  switch (mode) {
    case "time":
      return TIME_OPTIONS.map(String);
    case "words":
      return WORD_OPTIONS.map(String);
    case "quote":
      return QUOTE_LENGTHS;
    case "code":
      return CODE_TIME_OPTIONS.map(String);
  }
}

/** Returns a config with `--val` set for its mode, or `null` if the value is invalid. */
export function withValue(config: TestConfig, value: string): TestConfig | null {
  switch (config.mode) {
    case "time": {
      const n = Number(value);
      return isOneOf(TIME_OPTIONS, n) ? { ...config, time: n } : null;
    }
    case "words": {
      const n = Number(value);
      return isOneOf(WORD_OPTIONS, n) ? { ...config, words: n } : null;
    }
    case "quote":
      return isOneOf(QUOTE_LENGTHS, value) ? { ...config, quoteLength: value } : null;
    case "code": {
      const n = Number(value);
      return isOneOf(CODE_TIME_OPTIONS, n) ? { ...config, codeTime: n } : null;
    }
  }
}

export function isOneOf<T>(options: readonly T[], value: unknown): value is T {
  return options.includes(value as T);
}

/** Builds a valid config from untrusted input (cookie, storage), using defaults for bad fields. */
export function sanitizeConfig(input: unknown): TestConfig {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  return {
    mode: isOneOf(MODES, raw.mode) ? raw.mode : DEFAULT_CONFIG.mode,
    time: isOneOf(TIME_OPTIONS, raw.time) ? raw.time : DEFAULT_CONFIG.time,
    words: isOneOf(WORD_OPTIONS, raw.words) ? raw.words : DEFAULT_CONFIG.words,
    quoteLength: isOneOf(QUOTE_LENGTHS, raw.quoteLength) ? raw.quoteLength : DEFAULT_CONFIG.quoteLength,
    codeTime: isOneOf(CODE_TIME_OPTIONS, raw.codeTime) ? raw.codeTime : DEFAULT_CONFIG.codeTime,
    punct: typeof raw.punct === "boolean" ? raw.punct : DEFAULT_CONFIG.punct,
    nums: typeof raw.nums === "boolean" ? raw.nums : DEFAULT_CONFIG.nums,
    strictness: isOneOf(STRICTNESS_LEVELS, raw.strictness) ? raw.strictness : DEFAULT_CONFIG.strictness,
  };
}

/** The config as a CLI line, e.g. `run --mode words --val 25 --punct --strict expert`. */
export function toCliString(config: TestConfig): string {
  const parts = ["run", "--mode", config.mode, "--val", valueOf(config)];
  if (supportsModifiers(config.mode)) {
    if (config.punct) parts.push("--punct");
    if (config.nums) parts.push("--nums");
  }
  if (config.strictness !== "normal") parts.push("--strict", config.strictness);
  return parts.join(" ");
}

/** Short human label, e.g. `time 30 · punct · expert`. */
export function describeConfig(config: TestConfig): string {
  const parts = [`${config.mode} ${valueOf(config)}`];
  if (supportsModifiers(config.mode)) {
    if (config.punct) parts.push("punct");
    if (config.nums) parts.push("nums");
  }
  if (config.strictness !== "normal") parts.push(config.strictness);
  return parts.join(" · ");
}
