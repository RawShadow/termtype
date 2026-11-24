"use client";

import type { ReactNode } from "react";
import {
  MODES,
  STRICTNESS_LEVELS,
  supportsModifiers,
  valueOf,
  valueOptions,
  withValue,
  type TestConfig,
} from "@/lib/engine/config";

interface CommandBarProps {
  className?: string;
  /** Absent while the arena is still loading: only the prompt is shown. */
  config?: TestConfig;
  onChange?: (config: TestConfig) => void;
}

function Option({
  active,
  onClick,
  testId,
  children,
}: {
  active: boolean;
  onClick?: () => void;
  testId: string;
  children: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded px-1 outline-none transition-colors hover:text-text-primary focus-visible:bg-bg-primary/60 ${
        active ? "text-accent" : "text-text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Group({ flag, children }: { flag?: string; children: ReactNode }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-0.5">
      {flag && <span className="mr-1 text-text-muted/70">{flag}</span>}
      {children}
    </span>
  );
}

/** The `run --mode ... --val ...` line. Every value is a button; the active ones use the accent color. */
export function CommandBar({ className = "", config, onChange }: CommandBarProps) {
  const set = (next: TestConfig | null) => {
    if (next && onChange) onChange(next);
  };

  return (
    <div
      data-testid="command-bar"
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 self-center rounded-md bg-bg-surface/40 px-4 py-2 text-sm ${className}`}
    >
      <span>
        <span className="text-text-muted">guest@termtype</span>
        <span className="text-accent">:~$</span> <span className="text-text-primary">run</span>
      </span>
      {config && (
        <>
          <Group flag="--mode">
            {MODES.map((mode) => (
              <Option
                key={mode}
                testId={`opt-mode-${mode}`}
                active={config.mode === mode}
                onClick={() => set({ ...config, mode })}
              >
                {mode}
              </Option>
            ))}
          </Group>
          <Group flag="--val">
            {valueOptions(config.mode).map((value) => (
              <Option
                key={value}
                testId={`opt-val-${value}`}
                active={valueOf(config) === value}
                onClick={() => set(withValue(config, value))}
              >
                {value}
              </Option>
            ))}
          </Group>
          {supportsModifiers(config.mode) && (
            <Group>
              <Option testId="opt-punct" active={config.punct} onClick={() => set({ ...config, punct: !config.punct })}>
                --punct
              </Option>
              <Option testId="opt-nums" active={config.nums} onClick={() => set({ ...config, nums: !config.nums })}>
                --nums
              </Option>
            </Group>
          )}
          <Group flag="--strict">
            {STRICTNESS_LEVELS.map((strictness) => (
              <Option
                key={strictness}
                testId={`opt-strict-${strictness}`}
                active={config.strictness === strictness}
                onClick={() => set({ ...config, strictness })}
              >
                {strictness}
              </Option>
            ))}
          </Group>
        </>
      )}
    </div>
  );
}
