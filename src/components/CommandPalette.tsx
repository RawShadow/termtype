"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  applyEffect,
  COMMANDS,
  filterCommands,
  isActive,
  parseRunCommand,
  type Command,
} from "@/lib/commands";
import { describeConfig, type TestConfig } from "@/lib/engine/config";

interface CommandPaletteProps {
  config: TestConfig;
  onApply: (config: TestConfig) => void;
  onRestart: () => void;
  onRepeat: () => void;
  onClose: () => void;
}

/** `Esc` command palette: filter commands, or type the `run --mode ...` CLI form. */
export function CommandPalette({ config, onApply, onRestart, onRepeat, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const isRun = /^run(\s|$)/.test(query.trim());
  const parsed = isRun ? parseRunCommand(query, config) : null;
  const results = isRun ? [] : filterCommands(COMMANDS, query);
  const active = results.length === 0 ? -1 : Math.min(selected, results.length - 1);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const execute = (command: Command) => {
    const { effect } = command;
    if (effect.kind === "restart") onRestart();
    else if (effect.kind === "repeat") onRepeat();
    else onApply(applyEffect(config, effect));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const move = (delta: number) => {
      e.preventDefault();
      if (results.length > 0) setSelected((active + delta + results.length) % results.length);
    };
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "ArrowDown":
        move(1);
        break;
      case "ArrowUp":
        move(-1);
        break;
      case "Tab":
        move(e.shiftKey ? -1 : 1);
        break;
      case "Enter":
        e.preventDefault();
        if (parsed) {
          if (parsed.ok) onApply(parsed.config);
        } else if (active >= 0) {
          execute(results[active]);
        }
        break;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-primary/70 px-4 pt-[15vh] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        data-testid="command-palette"
        className="w-full max-w-lg animate-fade-in overflow-hidden rounded-md border border-text-muted/30 bg-bg-surface text-sm"
      >
        <label className="flex items-center gap-2 border-b border-bg-primary/60 px-4 py-3">
          <span className="text-accent">~$</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
            aria-label="Command"
            aria-controls="palette-options"
            aria-activedescendant={active >= 0 ? `palette-option-${results[active].id}` : undefined}
            placeholder="type a command, or run --mode words --val 25"
            className="w-full bg-transparent text-text-primary caret-accent outline-none placeholder:text-text-primary/50"
          />
        </label>

        {parsed ? (
          <div data-testid="palette-run-preview" className="px-4 py-3">
            {parsed.ok ? (
              <span className="text-text-primary/70">
                enter to run <span className="text-accent">{describeConfig(parsed.config)}</span>
              </span>
            ) : (
              <span className="text-error">{parsed.error}</span>
            )}
          </div>
        ) : (
          <ul ref={listRef} id="palette-options" role="listbox" className="max-h-72 overflow-y-auto py-1">
            {results.length === 0 && <li className="px-4 py-2 text-text-primary/70">no matching command</li>}
            {results.map((command, i) => (
              <li
                key={command.id}
                id={`palette-option-${command.id}`}
                role="option"
                aria-selected={i === active}
                data-index={i}
                data-testid="palette-option"
                onMouseMove={() => setSelected(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  execute(command);
                }}
                className={`flex cursor-pointer items-baseline justify-between gap-4 px-4 py-1.5 ${
                  i === active ? "bg-bg-primary/60 text-accent" : "text-text-primary"
                }`}
              >
                <span>
                  <span className="inline-block w-3 text-accent">{isActive(config, command) ? "*" : ""}</span>
                  {command.label}
                </span>
                <span className="truncate text-xs text-text-primary/70">{command.hint}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-4 border-t border-bg-primary/60 px-4 py-2 text-xs text-text-primary/70">
          <span>↑↓ select</span>
          <span>enter run</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
