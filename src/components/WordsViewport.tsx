"use client";

import { memo, useEffect, useLayoutEffect, useRef } from "react";
import { charStates, type CharState, type WordEntry } from "@/lib/engine";

const STATE_CLASS: Record<CharState, string> = {
  untyped: "text-text-muted",
  correct: "text-text-primary",
  incorrect: "text-error",
  extra: "text-error underline decoration-error decoration-1 underline-offset-[6px]",
};

const Word = memo(function Word({
  entry,
  index,
  active,
}: {
  entry: WordEntry;
  index: number;
  active: boolean;
}) {
  return (
    <div
      data-word={index}
      data-active={active || undefined}
      data-typed={entry.typed.length}
      className="mr-[1ch] flex h-12"
    >
      {charStates(entry).map((c, i) => (
        <span key={i} data-char data-state={c.state} className={STATE_CLASS[c.state]}>
          {c.char}
        </span>
      ))}
    </div>
  );
});

/**
 * Reads layout straight from the DOM and writes transforms directly, so caret
 * movement never costs an extra React render. Keeps the active word on line 2
 * once the caret reaches line 3.
 */
function positionCaret(inner: HTMLElement, caret: HTMLElement) {
  const word = inner.querySelector<HTMLElement>("[data-active]");
  if (!word) return;
  const lineHeight = word.offsetHeight;
  if (!lineHeight) return;

  const line = Math.round(word.offsetTop / lineHeight);
  const shift = Math.max(0, line - 1);
  inner.style.transform = `translateY(${-shift * lineHeight}px)`;
  inner.dataset.shift = String(shift);

  const chars = word.querySelectorAll<HTMLElement>("[data-char]");
  const typed = Number(word.dataset.typed);
  let x = word.offsetLeft;
  if (chars.length > 0) {
    if (typed < chars.length) {
      x = chars[typed].offsetLeft;
    } else {
      const last = chars[chars.length - 1];
      x = last.offsetLeft + last.offsetWidth;
    }
  }
  const y = word.offsetTop + (lineHeight - caret.offsetHeight) / 2;
  caret.style.transform = `translate(${x - caret.offsetWidth / 2}px, ${y}px)`;
}

interface WordsViewportProps {
  words: WordEntry[];
  wordIndex: number;
  /** Blink when idle; stay solid while the user is typing. */
  blinking: boolean;
  blurred: boolean;
}

export function WordsViewport({ words, wordIndex, blinking, blurred }: WordsViewportProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);

  // Runs after every render: positions are cheap DOM reads.
  useLayoutEffect(() => {
    if (innerRef.current && caretRef.current) positionCaret(innerRef.current, caretRef.current);
  });

  // Re-measure when fonts finish loading or the viewport is resized.
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const reposition = () => {
      if (innerRef.current && caretRef.current) positionCaret(innerRef.current, caretRef.current);
    };
    const observer = new ResizeObserver(reposition);
    observer.observe(inner);
    document.fonts?.ready.then(reposition);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      data-testid="words-viewport"
      className={`relative h-36 overflow-hidden text-[1.6rem] leading-12 transition-[filter] duration-200 ${
        blurred ? "blur-[3px]" : ""
      }`}
    >
      <div
        ref={innerRef}
        data-testid="words-inner"
        className="relative flex flex-wrap transition-transform duration-150 ease-out"
      >
        {words.map((entry, i) => (
          <Word key={i} entry={entry} index={i} active={i === wordIndex} />
        ))}
        <div
          ref={caretRef}
          data-testid="caret"
          aria-hidden
          className={`pointer-events-none absolute top-0 left-0 h-8 w-0.5 rounded-full bg-accent transition-transform duration-75 ease-out ${
            blinking ? "animate-caret-blink" : ""
          }`}
        />
      </div>
    </div>
  );
}
