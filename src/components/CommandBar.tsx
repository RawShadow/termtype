/** Display-only command bar. Phase 2 makes the mode flags interactive. */
export function CommandBar({ className = "" }: { className?: string }) {
  return (
    <div
      data-testid="command-bar"
      className={`self-center rounded-md bg-bg-surface/40 px-4 py-2 text-sm ${className}`}
    >
      <span className="text-text-muted">guest@termtype</span>
      <span className="text-accent">:~$</span> <span className="text-text-primary">run</span>{" "}
      <span className="text-text-muted">--mode</span> <span className="text-accent">time</span>{" "}
      <span className="text-text-muted">--val</span> <span className="text-accent">30</span>
    </div>
  );
}
