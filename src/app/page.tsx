import { connection } from "next/server";
import { Suspense } from "react";
import { ArenaFrame } from "@/components/ArenaFrame";
import { TypingArena } from "@/components/TypingArena";
import { randomSeed } from "@/lib/random";

/**
 * Picks the word seed per request so the server-rendered words match the
 * client exactly (no hydration mismatch) and differ on every visit.
 */
async function SeededArena() {
  await connection();
  return <TypingArena initialSeed={randomSeed()} />;
}

function ArenaShell() {
  return (
    <ArenaFrame dimmed={false}>
      <div aria-hidden>
        <div className="h-8" />
        <div className="h-36" />
      </div>
    </ArenaFrame>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<ArenaShell />}>
      <SeededArena />
    </Suspense>
  );
}
