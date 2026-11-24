import type { ReactNode } from "react";
import type { TestConfig } from "@/lib/engine/config";
import { CommandBar } from "./CommandBar";
import { Footer } from "./Footer";
import { Header } from "./Header";

interface ArenaFrameProps {
  /** Focus mode: fade the chrome while the user is typing. */
  dimmed: boolean;
  onReset?: () => void;
  config?: TestConfig;
  onConfigChange?: (config: TestConfig) => void;
  children: ReactNode;
}

/** Page chrome around the typing area; shared by the loading shell and the live arena. */
export function ArenaFrame({ dimmed, onReset, config, onConfigChange, children }: ArenaFrameProps) {
  const dim = `transition-opacity duration-300 ${dimmed ? "opacity-25" : "opacity-100"}`;
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-10">
      <Header className={dim} onReset={onReset} />
      <main className="flex flex-1 flex-col justify-center gap-8 py-10">
        <CommandBar className={dim} config={config} onChange={onConfigChange} />
        {children}
      </main>
      <Footer className={dim} />
    </div>
  );
}
