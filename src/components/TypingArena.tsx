"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createInitialState, engineReducer, getResult } from "@/lib/engine";
import { randomSeed } from "@/lib/random";
import { ArenaFrame } from "./ArenaFrame";
import { FinishedReadout } from "./FinishedReadout";
import { LiveCounter } from "./LiveCounter";
import { WordsViewport } from "./WordsViewport";

/** How long after the last keystroke the caret goes back to blinking. */
const TYPING_IDLE_MS = 500;
const TICK_INTERVAL_MS = 100;
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "AltGraph"]);

type KeyLike = Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "metaKey" | "preventDefault">;

export function TypingArena({ initialSeed }: { initialSeed: number }) {
  const [state, dispatch] = useReducer(engineReducer, initialSeed, (seed) =>
    createInitialState({ seed }),
  );
  const [focusMode, setFocusMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [focused, setFocused] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const tabArmed = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const restart = useCallback(() => {
    tabArmed.current = false;
    clearTimeout(typingTimer.current);
    setIsTyping(false);
    setFocusMode(false);
    dispatch({ type: "RESET", seed: randomSeed() });
    containerRef.current?.focus();
  }, []);

  const markTyping = useCallback(() => {
    setFocusMode(true);
    setIsTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setIsTyping(false), TYPING_IDLE_MS);
  }, []);

  /** Single keystroke handler: maps keys to engine actions, nothing else. */
  const handleKey = useCallback(
    (e: KeyLike) => {
      if (MODIFIER_KEYS.has(e.key)) return;
      const now = performance.now();

      if (e.key === "Tab") {
        e.preventDefault();
        tabArmed.current = true;
        return;
      }
      if (e.key === "Enter") {
        if (tabArmed.current) {
          e.preventDefault();
          restart();
        }
        return;
      }
      tabArmed.current = false;

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
    [restart, markTyping],
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
      const el = containerRef.current;
      if (!el || document.activeElement === el || MODIFIER_KEYS.has(e.key)) return;
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

  return (
    <ArenaFrame dimmed={focusMode && running} onReset={restart}>
      <div
        ref={containerRef}
        tabIndex={0}
        aria-label="Typing test. Start typing to begin; press tab then enter to restart."
        data-testid="typing-area"
        data-status={state.status}
        onKeyDown={(e) => handleKey(e)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="relative cursor-default outline-none"
      >
        <LiveCounter running={running} remaining={state.durationSec - state.snapshots.length} />
        {finished ? (
          <FinishedReadout result={getResult(state)} />
        ) : (
          <WordsViewport
            words={state.words}
            wordIndex={state.wordIndex}
            blinking={!isTyping}
            blurred={!focused}
          />
        )}
        {!focused && !finished && (
          <div
            data-testid="focus-hint"
            className="absolute inset-0 flex items-center justify-center text-sm text-text-muted"
          >
            click here or press any key to focus
          </div>
        )}
      </div>
    </ArenaFrame>
  );
}
