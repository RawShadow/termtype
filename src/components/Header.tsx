"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

interface HeaderProps {
  className?: string;
  /** When set, clicking the brand or [test] restarts the test instead of navigating. */
  onReset?: () => void;
}

export function Header({ className = "", onReset }: HeaderProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onReset) return;
    event.preventDefault();
    onReset();
  };

  return (
    <header data-testid="header" className={`flex items-center justify-between ${className}`}>
      <Link
        href="/"
        onClick={handleClick}
        className="text-xl text-text-primary outline-none hover:text-accent focus-visible:text-accent"
      >
        termtype<span className="text-accent">:~$</span>
      </Link>
      <nav className="text-sm text-text-muted">
        <Link
          href="/"
          onClick={handleClick}
          className="outline-none hover:text-text-primary focus-visible:text-text-primary"
        >
          [test]
        </Link>
      </nav>
    </header>
  );
}
