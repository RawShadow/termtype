"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { useAccount } from "./account/AccountProvider";

interface HeaderProps {
  className?: string;
  /** When set, clicking the brand or [test] restarts the test instead of navigating. */
  onReset?: () => void;
}

const linkClass = "rounded outline-none hover:text-text-primary focus-visible:text-text-primary";

export function Header({ className = "", onReset }: HeaderProps) {
  const ctx = useAccount();
  const pathname = usePathname();
  const account = ctx?.account ?? null;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onReset) return;
    event.preventDefault();
    onReset();
  };

  return (
    <header data-testid="header" className={`flex items-center justify-between gap-4 ${className}`}>
      <Link
        href="/"
        onClick={handleClick}
        className="text-xl text-text-primary outline-none hover:text-accent focus-visible:text-accent"
      >
        termtype<span className="text-accent">:~$</span>
      </Link>
      <nav className="flex items-center gap-3 text-sm text-text-muted">
        <Link href="/" onClick={handleClick} className={linkClass}>
          [test]
        </Link>
        {ctx?.configured &&
          (account ? (
            <>
              <Link href="/profile" data-testid="header-profile" className={`${linkClass} text-accent`}>
                @{account.username ?? "new-user"}
              </Link>
              <button
                type="button"
                data-testid="header-logout"
                onClick={() => void ctx.signOut(pathname === "/" ? undefined : "/")}
                className={linkClass}
              >
                [logout]
              </button>
            </>
          ) : (
            <Link href="/login" data-testid="header-login" className={linkClass}>
              [login]
            </Link>
          ))}
      </nav>
    </header>
  );
}
