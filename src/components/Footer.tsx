function Key({ children }: { children: string }) {
  return <kbd className="rounded bg-bg-surface px-1.5 py-0.5 text-text-primary">{children}</kbd>;
}

export function Footer({ className = "" }: { className?: string }) {
  return (
    <footer
      data-testid="footer"
      className={`flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-text-muted ${className}`}
    >
      <span>
        <Key>tab</Key> + <Key>enter</Key> - restart
      </span>
      <span aria-hidden className="hidden sm:inline">
        |
      </span>
      <span>
        <Key>esc</Key> - command palette
      </span>
    </footer>
  );
}
