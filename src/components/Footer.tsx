function Key({ children }: { children: string }) {
  return <kbd className="rounded bg-bg-surface px-1.5 py-0.5 text-text-primary">{children}</kbd>;
}

export function Footer({ className = "" }: { className?: string }) {
  return (
    <footer data-testid="footer" className={`text-center text-xs text-text-muted ${className}`}>
      <Key>tab</Key> + <Key>enter</Key> - restart
    </footer>
  );
}
