/** Seconds left (timed modes) or `completed/total` words, shown while a test runs. Space is always reserved. */
export function LiveCounter({ text }: { text: string | null }) {
  return (
    <div data-testid="live-counter" className="h-8 text-2xl text-accent tabular-nums" aria-live="off">
      {text}
    </div>
  );
}
