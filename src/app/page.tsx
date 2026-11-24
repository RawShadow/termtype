import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArenaFrame } from "@/components/ArenaFrame";
import { TypingArena } from "@/components/TypingArena";
import { randomSeed } from "@/lib/random";
import { CONFIG_COOKIE, parseConfigCookie } from "@/lib/settings";

/**
 * Reads the saved settings and picks the word seed per request, so the
 * server-rendered text matches the client exactly (no hydration mismatch)
 * and differs on every visit.
 */
async function SeededArena() {
  await connection();
  const store = await cookies();
  const config = parseConfigCookie(store.get(CONFIG_COOKIE)?.value);
  return <TypingArena initialSeed={randomSeed()} initialConfig={config} />;
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
