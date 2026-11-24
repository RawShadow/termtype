import {
  CODE_TIME_OPTIONS,
  isOneOf,
  MODES,
  QUOTE_LENGTHS,
  STRICTNESS_LEVELS,
  TIME_OPTIONS,
  WORD_OPTIONS,
  withValue,
  type TestConfig,
} from "@/lib/engine/config";

export type CommandEffect =
  | { kind: "config"; patch: Partial<TestConfig> }
  | { kind: "toggle"; key: "punct" | "nums" }
  | { kind: "restart" }
  | { kind: "repeat" };

export interface Command {
  id: string;
  /** What the user types / sees, e.g. `words 25`. */
  label: string;
  hint: string;
  effect: CommandEffect;
}

/** Every palette command. Static, so it is built once. */
export const COMMANDS: readonly Command[] = [
  { id: "restart", label: "restart", hint: "new test, same settings", effect: { kind: "restart" } },
  { id: "repeat", label: "repeat", hint: "same text again", effect: { kind: "repeat" } },
  ...MODES.map((mode) => ({
    id: `mode-${mode}`,
    label: `mode ${mode}`,
    hint: `switch to ${mode} mode`,
    effect: { kind: "config", patch: { mode } } as const,
  })),
  ...TIME_OPTIONS.map((time) => ({
    id: `time-${time}`,
    label: `time ${time}`,
    hint: `${time} second test`,
    effect: { kind: "config", patch: { mode: "time", time } } as const,
  })),
  ...WORD_OPTIONS.map((words) => ({
    id: `words-${words}`,
    label: `words ${words}`,
    hint: `${words} word test`,
    effect: { kind: "config", patch: { mode: "words", words } } as const,
  })),
  ...QUOTE_LENGTHS.map((quoteLength) => ({
    id: `quote-${quoteLength}`,
    label: `quote ${quoteLength}`,
    hint: quoteLength === "all" ? "any programming quote" : `${quoteLength} programming quote`,
    effect: { kind: "config", patch: { mode: "quote", quoteLength } } as const,
  })),
  ...CODE_TIME_OPTIONS.map((codeTime) => ({
    id: `code-${codeTime}`,
    label: `code ${codeTime}`,
    hint: `${codeTime}s of git, docker, bash, npm, js, python`,
    effect: { kind: "config", patch: { mode: "code", codeTime } } as const,
  })),
  { id: "punct", label: "punct", hint: "toggle punctuation + capitals", effect: { kind: "toggle", key: "punct" } },
  { id: "nums", label: "nums", hint: "toggle numbers", effect: { kind: "toggle", key: "nums" } },
  ...STRICTNESS_LEVELS.map((strictness) => ({
    id: `strict-${strictness}`,
    label: `strict ${strictness}`,
    hint:
      strictness === "normal"
        ? "mistakes are highlighted"
        : strictness === "expert"
          ? "submitting a wrong word fails the test"
          : "any wrong keystroke fails the test",
    effect: { kind: "config", patch: { strictness } } as const,
  })),
];

/** The config after a config/toggle effect (restart/repeat leave it unchanged). */
export function applyEffect(config: TestConfig, effect: CommandEffect): TestConfig {
  if (effect.kind === "config") return { ...config, ...effect.patch };
  if (effect.kind === "toggle") return { ...config, [effect.key]: !config[effect.key] };
  return config;
}

/** Whether a command describes the current config (shown as active in the palette). */
export function isActive(config: TestConfig, command: Command): boolean {
  const { effect } = command;
  if (effect.kind === "toggle") return config[effect.key];
  if (effect.kind !== "config") return false;
  return (Object.keys(effect.patch) as (keyof TestConfig)[]).every(
    (key) => config[key] === effect.patch[key],
  );
}

/**
 * Commands matching `query`: every whitespace-separated query term must be a
 * substring of the label. Labels starting with the query rank first.
 */
export function filterCommands(commands: readonly Command[], query: string): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...commands];
  const terms = q.split(/\s+/);
  const matches = commands.filter((c) => terms.every((t) => c.label.includes(t)));
  return [
    ...matches.filter((c) => c.label.startsWith(q)),
    ...matches.filter((c) => !c.label.startsWith(q)),
  ];
}

export type ParseResult = { ok: true; config: TestConfig } | { ok: false; error: string };

/**
 * Parses the CLI form shown in the command bar, starting from `current`:
 * `run --mode words --val 25 --punct --no-nums --strict expert`.
 * `--val` is read after `--mode`, wherever it appears.
 */
export function parseRunCommand(input: string, current: TestConfig): ParseResult {
  const tokens = input.trim().split(/\s+/);
  if (tokens[0] !== "run") return { ok: false, error: "commands start with run" };

  let config = { ...current };
  let value: string | undefined;
  for (let i = 1; i < tokens.length; i++) {
    const flag = tokens[i];
    const arg = tokens[i + 1];
    switch (flag) {
      case "--mode":
        if (!isOneOf(MODES, arg)) return { ok: false, error: `unknown mode: ${arg ?? "(missing)"}` };
        config = { ...config, mode: arg };
        i++;
        break;
      case "--val":
        if (arg === undefined) return { ok: false, error: "--val needs a value" };
        value = arg;
        i++;
        break;
      case "--strict":
        if (!isOneOf(STRICTNESS_LEVELS, arg)) {
          return { ok: false, error: `unknown strictness: ${arg ?? "(missing)"}` };
        }
        config = { ...config, strictness: arg };
        i++;
        break;
      case "--punct":
      case "--no-punct":
        config = { ...config, punct: flag === "--punct" };
        break;
      case "--nums":
      case "--no-nums":
        config = { ...config, nums: flag === "--nums" };
        break;
      default:
        return { ok: false, error: `unknown flag: ${flag}` };
    }
  }

  if (value !== undefined) {
    const withVal = withValue(config, value);
    if (!withVal) return { ok: false, error: `invalid --val for ${config.mode}: ${value}` };
    config = withVal;
  }
  return { ok: true, config };
}
