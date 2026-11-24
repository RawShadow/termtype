import type { TestResult } from "@/lib/engine";

/** Phase 1 end-of-test readout: net WPM with accuracy below. Phase 2 replaces it. */
export function FinishedReadout({ result }: { result: TestResult }) {
  return (
    <div
      data-testid="result"
      className="flex h-36 flex-col items-center justify-center gap-1"
      aria-live="polite"
    >
      <div className="flex items-baseline gap-3">
        <span data-testid="result-wpm" className="text-7xl leading-none text-text-primary">
          {result.netWpm}
        </span>
        <span className="text-xl text-text-muted">wpm</span>
      </div>
      <div className="text-xl">
        <span className="text-text-muted">acc </span>
        <span data-testid="result-acc" className="text-accent">
          {result.accuracy}%
        </span>
      </div>
    </div>
  );
}
