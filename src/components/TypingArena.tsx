"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createInitialState, engineReducer, getResult, type TestConfig } from "@/lib/engine";
import { submitRun, type SubmitResult } from "@/lib/account/runs";
import { runIdOf, toGuestRun } from "@/lib/history/guestRuns";
import { recordGuestRun } from "@/lib/history/guestRunsStore";
import { randomSeed } from "@/lib/random";
import { saveConfig } from "@/lib/settings";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useAccount } from "./account/AccountProvider";
import { ArenaFrame } from "./ArenaFrame";
import { CommandPalette } from "./CommandPalette";
import { LiveCounter } from "./LiveCounter";
import { ResultsView } from "./results/ResultsView";
import { WordsViewport } from "./WordsViewport";

/** How long after the last keystroke the caret goes back to blinking. */
const TYPING_IDLE_MS = 500;
const TICK_INTERVAL_MS = 100;
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "AltGraph"]);
const CONTROL_SELECTOR = "button, a, input, textarea, select, summary";

type KeyLike = Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "metaKey" | "preventDefault">;

interface TypingArenaProps {
  initialSeed: number;
  initialConfig: TestConfig;
}

export function TypingArena({ initialSeed, initialConfig }: TypingArenaProps) {
  const [state, dispatch] = useReducer(
    engineReducer,
    { seed: initialSeed, config: initialConfig },
    createInitialState,
  );
  const [focusMode, setFocusMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [focused, setFocused] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const tabArmed = useRef(false);
  const paletteOpenRef = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedRunId = useRef<string | null>(null);
  const [saveResults, setSaveResults] = useState<Record<string, SubmitResult>>({});
  const account = useAccount()?.account ?? null;

  const resetUi = useCallback(() => {
    tabArmed.current = false;
    clearTimeout(typingTimer.current);
    setIsTyping(false);
    setFocusMode(false);
    containerRef.current?.focus();
  }, []);

  /** New text; optionally with a new config. */
  const restart = useCallback(
    (config?: TestConfig) => {
      dispatch({ type: "RESET", seed: randomSeed(), config });
      resetUi();
    },
    [resetUi],
  );

  /** Same text, same settings. */
  const repeat = useCallback(() => {
    dispatch({ type: "REPEAT" });
    resetUi();
  }, [resetUi]);

  const applyConfig = useCallback(
    (config: TestConfig) => {
      saveConfig(config);
      restart(config);
    },
    [restart],
  );

  const openPalette = useCallback(() => {
    paletteOpenRef.current = true;
    tabArmed.current = false;
    setPaletteOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    paletteOpenRef.current = false;
    setPaletteOpen(false);
    containerRef.current?.focus();
  }, []);

  const markTyping = useCallback(() => {
    setFocusMode(true);
    setIsTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setIsTyping(false), TYPING_IDLE_MS);
  }, []);

  /**
   * Single keystroke handler: maps keys to engine actions, nothing else.
   * `fromControl` is set for keys pressed on a button inside the arena, which
   * keep their native behavior except for the Tab+Enter / Esc shortcuts.
   */
  const handleKey = useCallback(
    (e: KeyLike, fromControl = false) => {
      if (MODIFIER_KEYS.has(e.key)) return;
      const now = performance.now();

      if (e.key === "Escape") {
        e.preventDefault();
        openPalette();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        tabArmed.current = true;
        return;
      }
      if (e.key === "Enter" && tabArmed.current) {
        e.preventDefault();
        restart();
        return;
      }
      tabArmed.current = false;
      if (fromControl || e.key === "Enter") return;

      if (e.key === "Backspace") {
        e.preventDefault();
        dispatch({ type: e.ctrlKey || e.altKey ? "CLEAR_WORD" : "BACKSPACE" });
        markTyping();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === " ") {
        e.preventDefault();
        dispatch({ type: "SPACE", now });
        markTyping();
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        dispatch({ type: "CHAR", char: e.key, now });
        markTyping();
      }
    },
    [restart, markTyping, openPalette],
  );

  // Clock: the only timer, and it only runs while a test is in progress.
  useEffect(() => {
    if (state.status !== "running") return;
    const id = setInterval(
      () => dispatch({ type: "TICK", now: performance.now() }),
      TICK_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [state.status]);

  // Save each finished test exactly once: to the account when signed in with
  // a username (failed strict runs are not saved), otherwise to the local
  // guest history so it can be synced later.
  useEffect(() => {
    if (state.status !== "finished") return;
    const id = runIdOf(state);
    if (savedRunId.current === id) return;
    savedRunId.current = id;
    const run = toGuestRun(state, getResult(state), Date.now());
    if (!account?.username || !isSupabaseConfigured()) {
      recordGuestRun(run);
      return;
    }
    if (run.failReason) return;
    void submitRun(run).then((result) => {
      // Transient failure (offline, server key missing): keep the run in this
      // browser so the sign-in sync can save it later instead of losing it.
      if (result.outcome === "error") recordGuestRun(run);
      setSaveResults((prev) => ({ ...prev, [id]: result }));
    });
  }, [state, account]);

  // Mount: grab focus, leave focus mode on real mouse movement, and route
  // keystrokes back to the typing area if focus wandered off.
  useEffect(() => {
    containerRef.current?.focus();
    let lastPointer: { x: number; y: number } | null = null;

    const onMouseMove = (e: MouseEvent) => {
      const moved = lastPointer && (lastPointer.x !== e.clientX || lastPointer.y !== e.clientY);
      lastPointer = { x: e.clientX, y: e.clientY };
      if (moved) setFocusMode(false);
    };
    const onWindowKeyDown = (e: KeyboardEvent) => {
      // Dialogs (palette, sign-in, username) own the keyboard while open.
      if (paletteOpenRef.current || document.querySelector('[aria-modal="true"]')) return;
      const el = containerRef.current;
      if (!el || el.contains(document.activeElement) || MODIFIER_KEYS.has(e.key)) return;
      const onControl = e.target instanceof Element && e.target.closest(CONTROL_SELECTOR) !== null;
      if (onControl && e.key !== "Tab" && e.key !== "Escape") return;
      el.focus();
      handleKey(e);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onWindowKeyDown);
      clearTimeout(typingTimer.current);
    };
  }, [handleKey]);

  const running = state.status === "running";
  const finished = state.status === "finished";
  const counter = !running
    ? null
    : state.durationSec !== null
      ? String(state.durationSec - state.snapshots.length)
      : `${state.wordIndex}/${state.words.length}`;

  return (
    <>
      <ArenaFrame
        dimmed={focusMode && running && !paletteOpen}
        onReset={() => restart()}
        config={state.config}
        onConfigChange={applyConfig}
      >
        <div
          ref={containerRef}
          tabIndex={0}
          aria-label="Typing test. Start typing to begin; tab then enter restarts, escape opens the command palette."
          data-testid="typing-area"
          data-status={state.status}
          data-mode={state.config.mode}
          onKeyDown={(e) => handleKey(e, e.target !== e.currentTarget)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="relative cursor-default outline-none"
        >
          {finished ? (
            <ResultsView
              state={state}
              onNext={() => restart()}
              onRepeat={repeat}
              submitResult={saveResults[runIdOf(state)]}
            />
          ) : (
            <>
              <LiveCounter text={counter} />
              <WordsViewport
                words={state.words}
                wordIndex={state.wordIndex}
                blinking={!isTyping}
                blurred={!focused && !paletteOpen}
              />
              {!focused && !paletteOpen && (
                <div
                  data-testid="focus-hint"
                  className="absolute inset-0 flex items-center justify-center text-sm text-text-muted"
                >
                  click here or press any key to focus
                </div>
              )}
            </>
          )}
        </div>
      </ArenaFrame>
      {paletteOpen && (
        <CommandPalette
          config={state.config}
          onClose={closePalette}
          onApply={(config) => {
            closePalette();
            applyConfig(config);
          }}
          onRestart={() => {
            closePalette();
            restart();
          }}
          onRepeat={() => {
            closePalette();
            repeat();
          }}
        />
      )}
    </>
  );
}
