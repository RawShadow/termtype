import type { ReactNode } from "react";
import { Header } from "./Header";

/** Page chrome for non-arena pages (/login, /profile). */
export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-10">
      <Header />
      <main className="flex flex-1 flex-col py-10">{children}</main>
    </div>
  );
}
