/** Seconds remaining, shown only while a test is running (space is always reserved). */
export function LiveCounter({ running, remaining }: { running: boolean; remaining: number }) {
  return (
    <div data-testid="live-counter" className="h-8 text-2xl text-accent" aria-live="off">
      {running ? remaining : null}
    </div>
  );
}
